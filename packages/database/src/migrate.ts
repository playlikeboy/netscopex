import fs from "node:fs";
import path from "node:path";
import { getDbPool, query } from "./client.js";
import { logger } from "@netscopex/observability";

export async function runMigrations(): Promise<void> {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    // Acquire session-level advisory lock to serialize migrations across parallel workers/tests
    await client.query("SELECT pg_advisory_lock(999999);");

    logger.info("Initializing migration tracking...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationsDir = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "migrations"
    );

    if (!fs.existsSync(migrationsDir)) {
      logger.warn({ migrationsDir }, "No migrations directory found");
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const existing = await client.query(
        "SELECT version FROM schema_migrations WHERE version = $1",
        [file]
      );

      if (existing.rows.length === 0) {
        logger.info({ migration: file }, "Applying database migration...");
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");

        try {
          await client.query("BEGIN");
          await client.query(sql);
          await client.query(
            "INSERT INTO schema_migrations (version) VALUES ($1)",
            [file]
          );
          await client.query("COMMIT");
          logger.info({ migration: file }, "Successfully applied migration");
        } catch (err) {
          await client.query("ROLLBACK");
          logger.error({ err, migration: file }, "Migration failed, transaction rolled back");
          throw err;
        }
      } else {
        logger.debug({ migration: file }, "Migration already applied");
      }
    }
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(999999);");
    } catch {}
    client.release();
  }
}

if (process.argv[1]?.endsWith("migrate.ts") || process.argv[1]?.endsWith("migrate.js")) {
  runMigrations()
    .then(() => {
      logger.info("All migrations completed successfully");
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, "Migration process failed");
      process.exit(1);
    });
}
