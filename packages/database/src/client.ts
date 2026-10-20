import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { getConfig } from "@netscopex/config";
import { logger } from "@netscopex/observability";

let globalPool: Pool | null = null;

export function getDbPool(): Pool {
  if (!globalPool) {
    const config = getConfig();
    globalPool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    globalPool.on("error", (err) => {
      logger.error({ err }, "Unexpected error on idle PostgreSQL client");
    });
  }
  return globalPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const pool = getDbPool();
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn({ text, duration, rows: res.rowCount }, "Slow database query executed");
    }
    return res;
  } catch (err) {
    logger.error({ err, text, params }, "Database query error");
    throw err;
  }
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function closeDbPool(): Promise<void> {
  if (globalPool) {
    await globalPool.end();
    globalPool = null;
  }
}
