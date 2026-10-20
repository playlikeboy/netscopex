import { query } from "../client.js";
import { ProbeResult } from "@netscopex/contracts";

export class ProbeResultRepository {
  async insert(result: {
    jobId: string;
    monitorId: string;
    probeRegion: string;
    workerId: string;
    statusCode: number | null;
    success: boolean;
    timing: {
      dnsLookupMs: number;
      tcpConnectionMs: number;
      tlsHandshakeMs: number;
      ttfbMs: number;
      contentDownloadMs: number;
      totalDurationMs: number;
    };
    headers: Record<string, string>;
    bodyPreview?: string;
    error?: {
      classification: string;
      message: string;
      code?: string;
      details?: Record<string, unknown>;
    };
    traceId?: string;
    spanId?: string;
    executedAt: Date;
  }): Promise<ProbeResult> {
    const res = await query<any>(
      `
      INSERT INTO probe_results (
        job_id, monitor_id, probe_region, worker_id, status_code,
        success, timing, headers, body_preview, error,
        trace_id, span_id, executed_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (job_id) DO UPDATE SET
        success = EXCLUDED.success,
        timing = EXCLUDED.timing,
        status_code = EXCLUDED.status_code,
        error = EXCLUDED.error
      RETURNING *;
    `,
      [
        result.jobId,
        result.monitorId,
        result.probeRegion,
        result.workerId,
        result.statusCode,
        result.success,
        JSON.stringify(result.timing),
        JSON.stringify(result.headers),
        result.bodyPreview || null,
        result.error ? JSON.stringify(result.error) : null,
        result.traceId || null,
        result.spanId || null,
        result.executedAt.toISOString(),
      ]
    );

    return this.mapRow(res.rows[0]);
  }

  async listByMonitor(monitorId: string, limit = 50, since?: Date): Promise<ProbeResult[]> {
    let sql = `
      SELECT * FROM probe_results
      WHERE monitor_id = $1
    `;
    const params: unknown[] = [monitorId];

    if (since) {
      params.push(since.toISOString());
      sql += ` AND executed_at >= $2`;
    }

    params.push(limit);
    sql += ` ORDER BY executed_at DESC LIMIT $${params.length};`;

    const res = await query<any>(sql, params);
    return res.rows.map((r) => this.mapRow(r));
  }

  async getMetricsInWindow(
    monitorId: string,
    windowStart: Date,
    windowEnd: Date
  ): Promise<{
    totalCount: number;
    successCount: number;
    failureCount: number;
    avgLatencyMs: number;
    p50LatencyMs: number;
    p90LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    minLatencyMs: number;
    maxLatencyMs: number;
  }> {
    const res = await query<any>(
      `
      SELECT
        COUNT(*) AS total_count,
        COUNT(*) FILTER (WHERE success = true) AS success_count,
        COUNT(*) FILTER (WHERE success = false) AS failure_count,
        COALESCE(AVG((timing->>'totalDurationMs')::numeric), 0) AS avg_latency,
        COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY (timing->>'totalDurationMs')::numeric), 0) AS p50_latency,
        COALESCE(percentile_cont(0.90) WITHIN GROUP (ORDER BY (timing->>'totalDurationMs')::numeric), 0) AS p90_latency,
        COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY (timing->>'totalDurationMs')::numeric), 0) AS p95_latency,
        COALESCE(percentile_cont(0.99) WITHIN GROUP (ORDER BY (timing->>'totalDurationMs')::numeric), 0) AS p99_latency,
        COALESCE(MIN((timing->>'totalDurationMs')::numeric), 0) AS min_latency,
        COALESCE(MAX((timing->>'totalDurationMs')::numeric), 0) AS max_latency
      FROM probe_results
      WHERE monitor_id = $1
        AND executed_at >= $2
        AND executed_at <= $3;
    `,
      [monitorId, windowStart.toISOString(), windowEnd.toISOString()]
    );

    const r = res.rows[0];
    return {
      totalCount: parseInt(r.total_count, 10) || 0,
      successCount: parseInt(r.success_count, 10) || 0,
      failureCount: parseInt(r.failure_count, 10) || 0,
      avgLatencyMs: parseFloat(r.avg_latency) || 0,
      p50LatencyMs: parseFloat(r.p50_latency) || 0,
      p90LatencyMs: parseFloat(r.p90_latency) || 0,
      p95LatencyMs: parseFloat(r.p95_latency) || 0,
      p99LatencyMs: parseFloat(r.p99_latency) || 0,
      minLatencyMs: parseFloat(r.min_latency) || 0,
      maxLatencyMs: parseFloat(r.max_latency) || 0,
    };
  }

  private mapRow(row: any): ProbeResult {
    return {
      id: row.id,
      jobId: row.job_id,
      monitorId: row.monitor_id,
      probeRegion: row.probe_region,
      workerId: row.worker_id,
      statusCode: row.status_code,
      success: row.success,
      timing: typeof row.timing === "string" ? JSON.parse(row.timing) : row.timing,
      headers: typeof row.headers === "string" ? JSON.parse(row.headers) : row.headers || {},
      bodyPreview: row.body_preview || undefined,
      error:
        typeof row.error === "string"
          ? JSON.parse(row.error)
          : row.error || undefined,
      executedAt: new Date(row.executed_at).toISOString(),
      traceId: row.trace_id || undefined,
      spanId: row.span_id || undefined,
    };
  }
}
