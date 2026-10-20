import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  getDbPool,
  closeDbPool,
  runMigrations,
  ProbeJobRepository,
  MonitorRepository,
} from "@netscopex/database";

describe("Durable Queue & Lease Lifecycle Integration", () => {
  const jobRepo = new ProbeJobRepository();
  const monitorRepo = new MonitorRepository();
  let monitorId: string;

  beforeAll(async () => {
    // Run schema migrations on test database
    await runMigrations();

    // Clean up any stale probe jobs from previous benchmark runs
    await getDbPool().query("DELETE FROM probe_jobs");

    // Create a monitor to associate probe jobs
    const orgRes = await getDbPool().query(`
      INSERT INTO organizations (name, slug)
      VALUES ('Queue Test Org', 'queue-org-${Date.now()}')
      RETURNING id;
    `);
    const orgId = orgRes.rows[0].id;

    const projRes = await getDbPool().query(`
      INSERT INTO projects (org_id, name, slug)
      VALUES ($1, 'Queue Test Project', 'queue-proj-${Date.now()}')
      RETURNING id;
    `, [orgId]);
    const projectId = projRes.rows[0].id;

    const monitor = await monitorRepo.create({
      projectId,
      name: "Queue Lease Monitor",
      url: "https://example.com/health",
    });
    monitorId = monitor.id;
  });

  afterAll(async () => {
    await closeDbPool();
  });

  it("enqueues a probe job with unique epoch and rejects duplicate enqueues idempotently", async () => {
    const scheduledTime = new Date();
    const jobId1 = await jobRepo.enqueue(monitorId, scheduledTime, {
      url: "https://example.com/health",
      method: "GET",
      headers: {},
      timeoutMs: 5000,
      expectedStatusCodes: [200],
      degradedLatencyThresholdMs: 2000,
    });

    expect(jobId1).not.toBeNull();

    // Attempt duplicate enqueue for identical scheduled epoch
    const jobId2 = await jobRepo.enqueue(monitorId, scheduledTime, {
      url: "https://example.com/health",
      method: "GET",
      headers: {},
      timeoutMs: 5000,
      expectedStatusCodes: [200],
      degradedLatencyThresholdMs: 2000,
    });

    // Idempotent rejection: duplicate job was not inserted
    expect(jobId2).toBeNull();
  });

  it("leases pending jobs to worker using FOR UPDATE SKIP LOCKED and completes them", async () => {
    const scheduledTime = new Date(Date.now() - 5000); // 5s in past (due)
    const jobId = await jobRepo.enqueue(monitorId, scheduledTime, {
      url: "https://example.com/health",
      method: "GET",
      headers: {},
      timeoutMs: 5000,
      expectedStatusCodes: [200],
      degradedLatencyThresholdMs: 2000,
      targetRegion: "us-east-local",
    });

    const leasedJobs = await jobRepo.pollAndLease("worker-node-1", "us-east-local", 5, 30000);
    const matched = leasedJobs.find((j) => j.id === jobId);
    expect(matched).toBeDefined();
    expect(matched?.targetRegion).toBe("us-east-local");

    // Completing the job
    const completed = await jobRepo.completeJob(jobId!, "worker-node-1");
    expect(completed).toBe(true);
  });

  it("recovers abandoned/stale leases automatically after worker timeout", async () => {
    // Insert an artificially expired leased job
    const expiredJobId = `job_expired_${Date.now()}`;
    await getDbPool().query(`
      INSERT INTO probe_jobs (
        id, monitor_id, scheduled_for, scheduled_epoch, status,
        lease_owner, lease_expires_at, target_region
      )
      VALUES (
        $1, $2, NOW() - INTERVAL '10 seconds', 99999999, 'LEASED',
        'crashed-worker-node', NOW() - INTERVAL '5 seconds', 'us-east-local'
      );
    `, [expiredJobId, monitorId]);

    // Run stale lease recovery sweep
    const recoveredCount = await jobRepo.recoverStaleLeases();
    expect(recoveredCount).toBeGreaterThanOrEqual(1);

    // Verify job is now PENDING and can be claimed by a healthy worker
    const checkRes = await getDbPool().query(
      "SELECT status, lease_owner, lease_expires_at FROM probe_jobs WHERE id = $1",
      [expiredJobId]
    );
    expect(checkRes.rows[0].status).toBe("PENDING");
    expect(checkRes.rows[0].lease_owner).toBeNull();
  });
});
