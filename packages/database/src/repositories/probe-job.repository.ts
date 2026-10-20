import { query, withTransaction } from "../client.js";
import { ProbeJob } from "@netscopex/contracts";
import { logger } from "@netscopex/observability";

export class ProbeJobRepository {
  async enqueue(
    monitorId: string,
    scheduledFor: Date,
    options: {
      url: string;
      method: string;
      headers: Record<string, string>;
      body?: string;
      timeoutMs: number;
      expectedStatusCodes: number[];
      degradedLatencyThresholdMs: number;
      targetRegion?: string;
      traceParent?: string;
    }
  ): Promise<string | null> {
    const scheduledEpoch = Math.floor(scheduledFor.getTime() / 1000);
    const jobId = `job_${monitorId}_${scheduledEpoch}`;

    try {
      const res = await query(
        `
        INSERT INTO probe_jobs (
          id, monitor_id, scheduled_for, scheduled_epoch, status,
          target_region, trace_parent, attempt, max_retries
        )
        VALUES ($1, $2, $3, $4, 'PENDING', $5, $6, 0, 3)
        ON CONFLICT (monitor_id, scheduled_epoch) DO NOTHING
        RETURNING id;
      `,
        [
          jobId,
          monitorId,
          scheduledFor.toISOString(),
          scheduledEpoch,
          options.targetRegion || "us-east-local",
          options.traceParent || null,
        ]
      );

      if (res.rowCount === 0) {
        // Job already enqueued for this scheduled epoch (idempotent deduplication)
        return null;
      }
      return jobId;
    } catch (err) {
      logger.error({ err, jobId, monitorId }, "Failed to enqueue probe job");
      throw err;
    }
  }

  async pollAndLease(
    workerId: string,
    region: string,
    batchSize = 10,
    leaseDurationMs = 30000
  ): Promise<
    Array<{
      id: string;
      monitorId: string;
      url: string;
      method: string;
      headers: Record<string, string>;
      body?: string;
      timeoutMs: number;
      expectedStatusCodes: number[];
      degradedLatencyThresholdMs: number;
      targetRegion: string;
      traceParent?: string;
      attempt: number;
    }>
  > {
    return await withTransaction(async (client) => {
      // Find candidate jobs that are either PENDING and scheduled_for <= NOW(),
      // or LEASED but lease_expires_at < NOW() (expired leases)
      const selectRes = await client.query(
        `
        SELECT j.id, j.monitor_id, j.target_region, j.trace_parent, j.attempt,
               m.url, m.method, m.headers, m.body, m.timeout_ms,
               m.expected_status_codes, m.degraded_latency_threshold_ms
        FROM probe_jobs j
        JOIN monitors m ON m.id = j.monitor_id
        WHERE (
          (j.status = 'PENDING' AND j.scheduled_for <= NOW())
          OR (j.status = 'LEASED' AND j.lease_expires_at < NOW())
        )
        AND (j.target_region = $1 OR j.target_region = 'any' OR $1 = 'any')
        ORDER BY j.scheduled_for ASC
        LIMIT $2
        FOR UPDATE OF j SKIP LOCKED;
      `,
        [region, batchSize]
      );

      if (selectRes.rows.length === 0) {
        return [];
      }

      const jobIds = selectRes.rows.map((r) => r.id);
      const leaseExpiresAt = new Date(Date.now() + leaseDurationMs).toISOString();

      await client.query(
        `
        UPDATE probe_jobs
        SET status = 'LEASED',
            lease_owner = $1,
            lease_expires_at = $2,
            attempt = attempt + 1,
            updated_at = NOW()
        WHERE id = ANY($3::text[]);
      `,
        [workerId, leaseExpiresAt, jobIds]
      );

      return selectRes.rows.map((r) => ({
        id: r.id,
        monitorId: r.monitor_id,
        url: r.url,
        method: r.method,
        headers: typeof r.headers === "string" ? JSON.parse(r.headers) : r.headers || {},
        body: r.body || undefined,
        timeoutMs: r.timeout_ms,
        expectedStatusCodes: r.expected_status_codes,
        degradedLatencyThresholdMs: r.degraded_latency_threshold_ms,
        targetRegion: r.target_region,
        traceParent: r.trace_parent || undefined,
        attempt: r.attempt + 1,
      }));
    });
  }

  async renewLease(jobId: string, workerId: string, leaseDurationMs = 30000): Promise<boolean> {
    const leaseExpiresAt = new Date(Date.now() + leaseDurationMs).toISOString();
    const res = await query(
      `
      UPDATE probe_jobs
      SET lease_expires_at = $3,
          updated_at = NOW()
      WHERE id = $1 AND lease_owner = $2 AND status = 'LEASED';
    `,
      [jobId, workerId, leaseExpiresAt]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async completeJob(jobId: string, workerId: string): Promise<boolean> {
    const res = await query(
      `
      UPDATE probe_jobs
      SET status = 'COMPLETED',
          lease_owner = NULL,
          lease_expires_at = NULL,
          updated_at = NOW()
      WHERE id = $1 AND (lease_owner = $2 OR lease_owner IS NULL);
    `,
      [jobId, workerId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async failJob(
    jobId: string,
    workerId: string,
    maxRetries = 3,
    backoffMs = 5000
  ): Promise<boolean> {
    const res = await query(
      `
      UPDATE probe_jobs
      SET status = CASE WHEN attempt >= $3 THEN 'FAILED' ELSE 'PENDING' END,
          scheduled_for = CASE 
            WHEN attempt >= $3 THEN scheduled_for 
            ELSE NOW() + ($4 || ' milliseconds')::INTERVAL 
          END,
          lease_owner = NULL,
          lease_expires_at = NULL,
          updated_at = NOW()
      WHERE id = $1 AND lease_owner = $2;
    `,
      [jobId, workerId, maxRetries, backoffMs]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async recoverStaleLeases(): Promise<number> {
    const res = await query(`
      UPDATE probe_jobs
      SET status = 'PENDING',
          lease_owner = NULL,
          lease_expires_at = NULL,
          updated_at = NOW()
      WHERE status = 'LEASED' AND lease_expires_at < NOW();
    `);
    const count = res.rowCount ?? 0;
    if (count > 0) {
      logger.warn({ recoveredCount: count }, "Recovered abandoned/stale probe job leases");
    }
    return count;
  }

  async getQueueStats(): Promise<{
    pending: number;
    leased: number;
    completed: number;
    failed: number;
  }> {
    const res = await query<{ status: string; count: string }>(`
      SELECT status, COUNT(*)::text as count
      FROM probe_jobs
      GROUP BY status;
    `);

    const stats = { pending: 0, leased: 0, completed: 0, failed: 0 };
    for (const row of res.rows) {
      const c = parseInt(row.count, 10) || 0;
      if (row.status === "PENDING") stats.pending = c;
      if (row.status === "LEASED") stats.leased = c;
      if (row.status === "COMPLETED") stats.completed = c;
      if (row.status === "FAILED") stats.failed = c;
    }
    return stats;
  }
}
