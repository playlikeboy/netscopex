import { query } from "../client.js";

export interface WorkerRecord {
  workerId: string;
  region: string;
  hostname: string;
  concurrency: number;
  activeJobs: number;
  lastHeartbeatAt: string;
  status: string;
  startedAt: string;
}

export class WorkerRepository {
  async upsertHeartbeat(data: {
    workerId: string;
    region: string;
    hostname: string;
    concurrency: number;
    activeJobs: number;
  }): Promise<void> {
    await query(
      `
      INSERT INTO workers (
        worker_id, region, hostname, concurrency, active_jobs,
        last_heartbeat_at, status, started_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), 'HEALTHY', NOW())
      ON CONFLICT (worker_id) DO UPDATE SET
        active_jobs = EXCLUDED.active_jobs,
        last_heartbeat_at = NOW(),
        status = 'HEALTHY';
    `,
      [
        data.workerId,
        data.region,
        data.hostname,
        data.concurrency,
        data.activeJobs,
      ]
    );
  }

  async markUnhealthy(workerId: string): Promise<void> {
    await query(
      "UPDATE workers SET status = 'UNHEALTHY' WHERE worker_id = $1",
      [workerId]
    );
  }

  async listActive(healthyWindowSeconds = 45): Promise<WorkerRecord[]> {
    const res = await query<any>(
      `
      SELECT * FROM workers
      WHERE last_heartbeat_at >= NOW() - ($1 || ' seconds')::INTERVAL
      ORDER BY last_heartbeat_at DESC;
    `,
      [healthyWindowSeconds]
    );

    return res.rows.map((r) => ({
      workerId: r.worker_id,
      region: r.region,
      hostname: r.hostname,
      concurrency: r.concurrency,
      activeJobs: r.active_jobs,
      lastHeartbeatAt: new Date(r.last_heartbeat_at).toISOString(),
      status: r.status,
      startedAt: new Date(r.started_at).toISOString(),
    }));
  }
}
