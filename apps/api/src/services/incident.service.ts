import {
  Incident,
  IncidentEvent,
  IncidentStatus,
} from "@netscopex/contracts";
import {
  IncidentRepository,
  ProbeResultRepository,
  MonitorRepository,
} from "@netscopex/database";
import { diagnoseIncident } from "../engine/diagnosis-engine.js";

export class IncidentService {
  private incidentRepo = new IncidentRepository();
  private resultRepo = new ProbeResultRepository();
  private monitorRepo = new MonitorRepository();

  async listIncidents(projectId: string, status?: IncidentStatus): Promise<Incident[]> {
    return this.incidentRepo.listByProject(projectId, status);
  }

  async getIncident(id: string): Promise<Incident | null> {
    return this.incidentRepo.findById(id);
  }

  async acknowledge(id: string, user: string): Promise<Incident | null> {
    return this.incidentRepo.acknowledge(id, user);
  }

  async resolve(id: string, user: string, reason?: string): Promise<Incident | null> {
    return this.incidentRepo.resolve(id, user, reason);
  }

  async getTimeline(id: string): Promise<IncidentEvent[]> {
    return this.incidentRepo.getTimeline(id);
  }

  async getReplay(id: string): Promise<{
    incident: Incident;
    timeline: IncidentEvent[];
    diagnosticFinding?: any;
    durationMinutes: number;
  }> {
    const incident = await this.incidentRepo.findById(id);
    if (!incident) throw new Error("Incident not found");

    const timeline = await this.incidentRepo.getTimeline(id);

    let diagnosticFinding;
    if (incident.lastProbeResultId) {
      const results = await this.resultRepo.listByMonitor(incident.monitorId, 1);
      if (results[0]) {
        diagnosticFinding = diagnoseIncident({
          monitorId: incident.monitorId,
          incidentId: incident.id,
          probeResult: results[0],
        });
      }
    }

    const start = new Date(incident.triggeredAt).getTime();
    const end = incident.resolvedAt
      ? new Date(incident.resolvedAt).getTime()
      : Date.now();
    const durationMinutes = Number(((end - start) / 60000).toFixed(1));

    return {
      incident,
      timeline,
      diagnosticFinding,
      durationMinutes,
    };
  }

  async generatePostIncidentReport(id: string): Promise<string> {
    const replay = await this.getReplay(id);
    const inc = replay.incident;
    const monitor = await this.monitorRepo.findById(inc.monitorId);

    const lines: string[] = [
      `# Post-Incident Report (PIR): ${inc.title}`,
      `**Incident ID:** \`${inc.id}\``,
      `**Monitor:** ${monitor?.name || inc.monitorId} (\`${monitor?.url || "N/A"}\`)`,
      `**Severity:** ${inc.severity}`,
      `**Status:** ${inc.status}`,
      `**Triggered At:** ${inc.triggeredAt}`,
      `**Acknowledged At:** ${inc.acknowledgedAt || "Not acknowledged"} (By: ${inc.acknowledgedBy || "N/A"})`,
      `**Resolved At:** ${inc.resolvedAt || "Ongoing"} (By: ${inc.resolvedBy || "N/A"})`,
      `**Total Outage Duration:** ${replay.durationMinutes} minutes`,
      ``,
      `## Executive Summary`,
      inc.rootCauseSummary || "Automated health checks detected consecutive target service failures breaching SLA thresholds.",
      ``,
      `## Root Cause Findings & Supporting Evidence`,
    ];

    if (replay.diagnosticFinding) {
      lines.push(`**Failure Category:** ${replay.diagnosticFinding.category} (Confidence: ${replay.diagnosticFinding.confidence})`);
      lines.push(`### Recorded Facts:`);
      for (const fact of replay.diagnosticFinding.facts) {
        lines.push(`- ${fact}`);
      }
      lines.push(`### Inferred Hypotheses:`);
      for (const hyp of replay.diagnosticFinding.hypotheses) {
        lines.push(`- ${hyp}`);
      }
      lines.push(`### Recommended Preventive Actions:`);
      for (const act of replay.diagnosticFinding.recommendedActions) {
        lines.push(`- [ ] ${act}`);
      }
    } else {
      lines.push(`- No detailed diagnostic finding recorded.`);
    }

    lines.push(``);
    lines.push(`## Incident Timeline of Events`);
    for (const evt of replay.timeline) {
      lines.push(`- **${evt.timestamp}** — \`${evt.type}\`: ${JSON.stringify(evt.payload)}`);
    }

    return lines.join("\n");
  }
}
