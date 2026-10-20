import { query } from "../client.js";
import { NotificationChannel } from "@netscopex/contracts";

export class NotificationRepository {
  async listByProject(projectId: string): Promise<NotificationChannel[]> {
    const res = await query<any>(
      "SELECT * FROM notification_channels WHERE project_id = $1 AND enabled = true",
      [projectId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      name: r.name,
      type: r.type,
      destination: r.destination,
      secret: r.secret || undefined,
      enabled: r.enabled,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  }

  async recordDeliveryAttempt(
    channelId: string,
    incidentId: string,
    idempotencyKey: string,
    status: "PENDING" | "SENT" | "FAILED",
    lastError?: string
  ): Promise<boolean> {
    const res = await query(
      `
      INSERT INTO alert_deliveries (
        channel_id, incident_id, idempotency_key, status, attempts, last_error, sent_at
      )
      VALUES (
        $1, $2, $3, $4, 1, $5,
        CASE WHEN $4 = 'SENT' THEN NOW() ELSE NULL END
      )
      ON CONFLICT (idempotency_key) DO UPDATE SET
        attempts = alert_deliveries.attempts + 1,
        status = EXCLUDED.status,
        last_error = EXCLUDED.last_error,
        sent_at = CASE WHEN EXCLUDED.status = 'SENT' THEN NOW() ELSE alert_deliveries.sent_at END
      RETURNING id;
    `,
      [channelId, incidentId, idempotencyKey, status, lastError || null]
    );

    return (res.rowCount ?? 0) > 0;
  }
}
