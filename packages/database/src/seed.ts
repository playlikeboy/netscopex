import { query, withTransaction } from "./client.js";
import { logger } from "@netscopex/observability";

export async function seedDatabase(): Promise<{
  orgId: string;
  projectId: string;
  userId: string;
  monitorIds: string[];
}> {
  logger.info("Seeding database with default entities...");

  return await withTransaction(async (client) => {
    // 1. Organization
    const orgRes = await client.query(`
      INSERT INTO organizations (name, slug)
      VALUES ('Acme Corp', 'acme')
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `);
    const orgId = orgRes.rows[0].id;

    // 2. User
    const userRes = await client.query(`
      INSERT INTO users (org_id, email, name, role, password_hash)
      VALUES ($1, 'admin@netscopex.io', 'Admin User', 'admin', 'pbkdf2:hash_placeholder_for_demo')
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [orgId]);
    const userId = userRes.rows[0].id;

    // 3. Project
    const projRes = await client.query(`
      INSERT INTO projects (org_id, name, slug)
      VALUES ($1, 'Production Core', 'prod-core')
      ON CONFLICT (org_id, slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id;
    `, [orgId]);
    const projectId = projRes.rows[0].id;

    // 4. Default Monitors
    const monitor1Res = await client.query(`
      INSERT INTO monitors (project_id, name, url, method, interval_seconds, timeout_ms, expected_status_codes, state, tags)
      VALUES ($1, 'API Gateway Health', 'https://api.github.com/zen', 'GET', 30, 4000, '{200}', 'active', '{"api", "core"}')
      RETURNING id;
    `, [projectId]);
    const monitorId1 = monitor1Res.rows[0].id;

    const monitor2Res = await client.query(`
      INSERT INTO monitors (project_id, name, url, method, interval_seconds, timeout_ms, expected_status_codes, state, tags)
      VALUES ($1, 'Checkout Microservice', 'https://httpbin.org/status/200', 'GET', 60, 5000, '{200}', 'active', '{"checkout", "p1"}')
      RETURNING id;
    `, [projectId]);
    const monitorId2 = monitor2Res.rows[0].id;

    // 5. SLOs
    await client.query(`
      INSERT INTO slos (project_id, monitor_id, name, type, target_percent, "window", burn_rate_alert_threshold)
      VALUES ($1, $2, 'API Gateway 99.9% Availability (30d)', 'AVAILABILITY', 99.900, '30d', 14.40);
    `, [projectId, monitorId1]);

    await client.query(`
      INSERT INTO slos (project_id, monitor_id, name, type, target_percent, "window", latency_threshold_ms, burn_rate_alert_threshold)
      VALUES ($1, $2, 'Checkout p95 Latency < 400ms (7d)', 'LATENCY', 95.000, '7d', 400, 6.00);
    `, [projectId, monitorId2]);

    // 6. Notification Channel
    await client.query(`
      INSERT INTO notification_channels (project_id, name, type, destination, secret)
      VALUES ($1, 'Ops Slack Webhook (Mock)', 'WEBHOOK', 'https://hooks.slack.com/services/MOCK/TOKEN/XYZ', 'test-signing-secret-123');
    `, [projectId]);

    logger.info({ orgId, projectId, monitorIds: [monitorId1, monitorId2] }, "Database seeded successfully");
    return {
      orgId,
      projectId,
      userId,
      monitorIds: [monitorId1, monitorId2],
    };
  });
}

if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, "Seed script failed");
      process.exit(1);
    });
}
