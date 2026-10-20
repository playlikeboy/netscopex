import { query, withTransaction } from "../client.js";
import {
  Incident,
  IncidentEvent,
  IncidentSeverity,
  IncidentStatus,
} from "@netscopex/contracts";

export class IncidentRepository {
  async findActiveByMonitor(monitorId: string): Promise<Incident | null> {
    const res = await query<any>(
      `
      SELECT * FROM incidents
      WHERE monitor_id = $1 AND status IN ('TRIGGERED', 'ACKNOWLEDGED')
      ORDER BY triggered_at DESC
      LIMIT 1;
    `,
      [monitorId]
    );

    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  async findById(id: string): Promise<Incident | null> {
    const res = await query<any>("SELECT * FROM incidents WHERE id = $1", [id]);
    if (res.rows.length === 0) return null;
    return this.mapRow(res.rows[0]);
  }

  async listByProject(projectId: string, status?: IncidentStatus): Promise<Incident[]> {
    let sql = "SELECT * FROM incidents WHERE project_id = $1";
    const params: unknown[] = [projectId];

    if (status) {
      params.push(status);
      sql += " AND status = $2";
    }

    sql += " ORDER BY triggered_at DESC;";

    const res = await query<any>(sql, params);
    return res.rows.map((r) => this.mapRow(r));
  }

  async create(data: {
    projectId: string;
    monitorId: string;
    title: string;
    severity?: IncidentSeverity;
    consecutiveFailureCount: number;
    rootCauseSummary?: string;
    lastProbeResultId?: string;
    runbookUrl?: string;
  }): Promise<Incident> {
    return await withTransaction(async (client) => {
      // Create incident
      const incRes = await client.query<any>(
        `
        INSERT INTO incidents (
          project_id, monitor_id, title, severity, status,
          consecutive_failure_count, root_cause_summary, last_probe_result_id,
          runbook_url, triggered_at
        )
        VALUES ($1, $2, $3, $4, 'TRIGGERED', $5, $6, $7, $8, NOW())
        RETURNING *;
      `,
        [
          data.projectId,
          data.monitorId,
          data.title,
          data.severity || "HIGH",
          data.consecutiveFailureCount,
          data.rootCauseSummary || null,
          data.lastProbeResultId || null,
          data.runbookUrl || null,
        ]
      );

      const incident = this.mapRow(incRes.rows[0]);

      // Record TRIGGERED event
      await client.query(
        `
        INSERT INTO incident_events (incident_id, type, payload, timestamp)
        VALUES ($1, 'TRIGGERED', $2, NOW());
      `,
        [
          incident.id,
          JSON.stringify({
            title: incident.title,
            consecutiveFailureCount: incident.consecutiveFailureCount,
            rootCauseSummary: incident.rootCauseSummary,
          }),
        ]
      );

      return incident;
    });
  }

  async acknowledge(incidentId: string, acknowledgedBy: string): Promise<Incident | null> {
    return await withTransaction(async (client) => {
      const res = await client.query<any>(
        `
        UPDATE incidents
        SET status = 'ACKNOWLEDGED',
            acknowledged_at = NOW(),
            acknowledged_by = $2,
            updated_at = NOW()
        WHERE id = $1 AND status = 'TRIGGERED'
        RETURNING *;
      `,
        [incidentId, acknowledgedBy]
      );

      if (res.rows.length === 0) return null;
      const incident = this.mapRow(res.rows[0]);

      await client.query(
        `
        INSERT INTO incident_events (incident_id, type, payload, timestamp)
        VALUES ($1, 'ACKNOWLEDGED', $2, NOW());
      `,
        [incidentId, JSON.stringify({ acknowledgedBy })]
      );

      return incident;
    });
  }

  async resolve(incidentId: string, resolvedBy: string, reason?: string): Promise<Incident | null> {
    return await withTransaction(async (client) => {
      const res = await client.query<any>(
        `
        UPDATE incidents
        SET status = 'RESOLVED',
            resolved_at = NOW(),
            resolved_by = $2,
            updated_at = NOW()
        WHERE id = $1 AND status IN ('TRIGGERED', 'ACKNOWLEDGED')
        RETURNING *;
      `,
        [incidentId, resolvedBy]
      );

      if (res.rows.length === 0) return null;
      const incident = this.mapRow(res.rows[0]);

      await client.query(
        `
        INSERT INTO incident_events (incident_id, type, payload, timestamp)
        VALUES ($1, 'RESOLVED', $2, NOW());
      `,
        [incidentId, JSON.stringify({ resolvedBy, reason })]
      );

      return incident;
    });
  }

  async addEvent(
    incidentId: string,
    type: string,
    payload: Record<string, unknown> = {}
  ): Promise<IncidentEvent> {
    const res = await query<any>(
      `
      INSERT INTO incident_events (incident_id, type, payload, timestamp)
      VALUES ($1, $2, $3, NOW())
      RETURNING *;
    `,
      [incidentId, type, JSON.stringify(payload)]
    );

    const r = res.rows[0];
    return {
      id: r.id,
      incidentId: r.incident_id,
      type: r.type,
      payload: typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload,
      timestamp: new Date(r.timestamp).toISOString(),
    };
  }

  async getTimeline(incidentId: string): Promise<IncidentEvent[]> {
    const res = await query<any>(
      `
      SELECT * FROM incident_events
      WHERE incident_id = $1
      ORDER BY timestamp ASC;
    `,
      [incidentId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      incidentId: r.incident_id,
      type: r.type,
      payload: typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload,
      timestamp: new Date(r.timestamp).toISOString(),
    }));
  }

  private mapRow(row: any): Incident {
    return {
      id: row.id,
      projectId: row.project_id,
      monitorId: row.monitor_id,
      title: row.title,
      severity: row.severity,
      status: row.status,
      triggeredAt: new Date(row.triggered_at).toISOString(),
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at).toISOString() : null,
      acknowledgedBy: row.acknowledged_by || null,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
      resolvedBy: row.resolved_by || null,
      consecutiveFailureCount: row.consecutive_failure_count,
      rootCauseSummary: row.root_cause_summary || null,
      lastProbeResultId: row.last_probe_result_id || null,
      runbookUrl: row.runbook_url || null,
    };
  }
}
