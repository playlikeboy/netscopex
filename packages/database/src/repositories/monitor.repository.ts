import { query } from "../client.js";
import { MonitorConfig, MonitorLifecycleState } from "@netscopex/contracts";

export class MonitorRepository {
  async create(data: {
    projectId: string;
    name: string;
    url: string;
    method?: string;
    intervalSeconds?: number;
    timeoutMs?: number;
    expectedStatusCodes?: number[];
    headers?: Record<string, string>;
    body?: string;
    degradedThresholdCount?: number;
    downThresholdCount?: number;
    recoveryThresholdCount?: number;
    degradedLatencyThresholdMs?: number;
    probeRegionPreference?: string[];
    tags?: string[];
  }): Promise<MonitorConfig> {
    const res = await query<any>(
      `
      INSERT INTO monitors (
        project_id, name, url, method, interval_seconds, timeout_ms,
        expected_status_codes, headers, body, degraded_threshold_count,
        down_threshold_count, recovery_threshold_count, degraded_latency_threshold_ms,
        probe_region_preference, tags, state
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'unknown')
      RETURNING *;
    `,
      [
        data.projectId,
        data.name,
        data.url,
        data.method || "GET",
        data.intervalSeconds || 60,
        data.timeoutMs || 5000,
        data.expectedStatusCodes || [200],
        JSON.stringify(data.headers || {}),
        data.body || null,
        data.degradedThresholdCount || 2,
        data.downThresholdCount || 3,
        data.recoveryThresholdCount || 2,
        data.degradedLatencyThresholdMs || 2000,
        data.probeRegionPreference || ["us-east-local"],
        data.tags || [],
      ]
    );

    return this.mapRow(res.rows[0]);
  }

  async findById(id: string): Promise<MonitorConfig | null> {
    const res = await query<any>("SELECT * FROM monitors WHERE id = $1", [id]);
    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  async listByProject(projectId: string): Promise<MonitorConfig[]> {
    const res = await query<any>(
      "SELECT * FROM monitors WHERE project_id = $1 ORDER BY created_at DESC",
      [projectId]
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  async update(id: string, data: Partial<MonitorConfig>): Promise<MonitorConfig | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(data.name);
    }
    if (data.url !== undefined) {
      fields.push(`url = $${idx++}`);
      values.push(data.url);
    }
    if (data.method !== undefined) {
      fields.push(`method = $${idx++}`);
      values.push(data.method);
    }
    if (data.intervalSeconds !== undefined) {
      fields.push(`interval_seconds = $${idx++}`);
      values.push(data.intervalSeconds);
    }
    if (data.timeoutMs !== undefined) {
      fields.push(`timeout_ms = $${idx++}`);
      values.push(data.timeoutMs);
    }
    if (data.expectedStatusCodes !== undefined) {
      fields.push(`expected_status_codes = $${idx++}`);
      values.push(data.expectedStatusCodes);
    }
    if (data.headers !== undefined) {
      fields.push(`headers = $${idx++}`);
      values.push(JSON.stringify(data.headers));
    }
    if (data.body !== undefined) {
      fields.push(`body = $${idx++}`);
      values.push(data.body);
    }
    if (data.tags !== undefined) {
      fields.push(`tags = $${idx++}`);
      values.push(data.tags);
    }

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const res = await query<any>(
      `UPDATE monitors SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *;`,
      values
    );

    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  async updateState(
    id: string,
    state: MonitorLifecycleState,
    stateReason: string,
    counters: {
      consecutiveFailures: number;
      consecutiveSuccesses: number;
      consecutiveDegraded: number;
    },
    lastCheckedAt: Date
  ): Promise<MonitorConfig | null> {
    const res = await query<any>(
      `
      UPDATE monitors
      SET state = $2,
          state_reason = $3,
          consecutive_failures = $4,
          consecutive_successes = $5,
          consecutive_degraded = $6,
          last_checked_at = $7,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `,
      [
        id,
        state,
        stateReason,
        counters.consecutiveFailures,
        counters.consecutiveSuccesses,
        counters.consecutiveDegraded,
        lastCheckedAt.toISOString(),
      ]
    );

    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const res = await query("DELETE FROM monitors WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async findDueForCheck(limit = 100): Promise<MonitorConfig[]> {
    const res = await query<any>(
      `
      SELECT * FROM monitors
      WHERE state != 'paused'
        AND (
          last_checked_at IS NULL
          OR last_checked_at <= NOW() - (interval_seconds || ' seconds')::INTERVAL
        )
      ORDER BY last_checked_at ASC NULLS FIRST
      LIMIT $1;
    `,
      [limit]
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  private mapRow(row: any): MonitorConfig {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      url: row.url,
      method: row.method,
      intervalSeconds: row.interval_seconds,
      timeoutMs: row.timeout_ms,
      expectedStatusCodes: row.expected_status_codes,
      headers: typeof row.headers === "string" ? JSON.parse(row.headers) : row.headers || {},
      body: row.body || undefined,
      state: row.state,
      stateReason: row.state_reason || undefined,
      degradedThresholdCount: row.degraded_threshold_count,
      downThresholdCount: row.down_threshold_count,
      recoveryThresholdCount: row.recovery_threshold_count,
      consecutiveFailures: row.consecutive_failures,
      consecutiveSuccesses: row.consecutive_successes,
      consecutiveDegraded: row.consecutive_degraded,
      degradedLatencyThresholdMs: row.degraded_latency_threshold_ms,
      probeRegionPreference: row.probe_region_preference || ["us-east-local"],
      tags: row.tags || [],
      lastCheckedAt: row.last_checked_at ? new Date(row.last_checked_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
}
