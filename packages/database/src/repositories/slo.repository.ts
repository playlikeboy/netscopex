import { query } from "../client.js";
import { SloDefinition, SloType, SloWindow } from "@netscopex/contracts";

export class SloRepository {
  async create(data: {
    projectId: string;
    monitorId: string;
    name: string;
    type: SloType;
    targetPercent: number;
    window: SloWindow;
    latencyThresholdMs?: number;
    burnRateAlertThreshold?: number;
  }): Promise<SloDefinition> {
    const res = await query<any>(
      `
      INSERT INTO slos (
        project_id, monitor_id, name, type, target_percent,
        "window", latency_threshold_ms, burn_rate_alert_threshold
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `,
      [
        data.projectId,
        data.monitorId,
        data.name,
        data.type,
        data.targetPercent,
        data.window,
        data.latencyThresholdMs || null,
        data.burnRateAlertThreshold || 14.4,
      ]
    );

    return this.mapRow(res.rows[0]);
  }

  async findById(id: string): Promise<SloDefinition | null> {
    const res = await query<any>("SELECT * FROM slos WHERE id = $1", [id]);
    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  async listByProject(projectId: string): Promise<SloDefinition[]> {
    const res = await query<any>(
      "SELECT * FROM slos WHERE project_id = $1 ORDER BY created_at DESC",
      [projectId]
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  async listByMonitor(monitorId: string): Promise<SloDefinition[]> {
    const res = await query<any>(
      "SELECT * FROM slos WHERE monitor_id = $1 ORDER BY created_at DESC",
      [monitorId]
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  async delete(id: string): Promise<boolean> {
    const res = await query("DELETE FROM slos WHERE id = $1", [id]);
    return (res.rowCount ?? 0) > 0;
  }

  private mapRow(row: any): SloDefinition {
    return {
      id: row.id,
      projectId: row.project_id,
      monitorId: row.monitor_id,
      name: row.name,
      type: row.type,
      targetPercent: parseFloat(row.target_percent),
      window: row.window,
      latencyThresholdMs: row.latency_threshold_ms || undefined,
      burnRateAlertThreshold: parseFloat(row.burn_rate_alert_threshold),
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }
}
