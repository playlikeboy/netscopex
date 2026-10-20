import {
  SloCalculationResult,
  SloDefinition,
  SloType,
  SloWindow,
} from "@netscopex/contracts";
import {
  SloRepository,
  ProbeResultRepository,
} from "@netscopex/database";
import { calculateSlo } from "../engine/slo-calculator.js";

export class SloService {
  private sloRepo = new SloRepository();
  private resultRepo = new ProbeResultRepository();

  async listSlos(projectId: string): Promise<SloDefinition[]> {
    return this.sloRepo.listByProject(projectId);
  }

  async getSlo(id: string): Promise<SloDefinition | null> {
    return this.sloRepo.findById(id);
  }

  async createSlo(data: {
    projectId: string;
    monitorId: string;
    name: string;
    type: SloType;
    targetPercent: number;
    window: SloWindow;
    latencyThresholdMs?: number;
    burnRateAlertThreshold?: number;
  }): Promise<SloDefinition> {
    return this.sloRepo.create(data);
  }

  async deleteSlo(id: string): Promise<boolean> {
    return this.sloRepo.delete(id);
  }

  async evaluateSlo(sloId: string): Promise<SloCalculationResult> {
    const slo = await this.sloRepo.findById(sloId);
    if (!slo) throw new Error("SLO not found");

    const now = new Date();
    let windowDurationMs = 3600 * 1000; // default 1h
    if (slo.window === "24h") windowDurationMs = 24 * 3600 * 1000;
    else if (slo.window === "7d") windowDurationMs = 7 * 24 * 3600 * 1000;
    else if (slo.window === "30d") windowDurationMs = 30 * 24 * 3600 * 1000;

    const windowStart = new Date(now.getTime() - windowDurationMs);

    // Fetch probe results in window
    const results = await this.resultRepo.listByMonitor(
      slo.monitorId,
      10000,
      windowStart
    );

    const totalEvents = results.length;
    let goodEvents = 0;

    for (const r of results) {
      if (slo.type === "AVAILABILITY") {
        if (r.success) goodEvents++;
      } else if (slo.type === "LATENCY") {
        const threshold = slo.latencyThresholdMs || 500;
        if (r.success && r.timing.totalDurationMs <= threshold) {
          goodEvents++;
        }
      }
    }

    return calculateSlo({
      slo,
      totalEvents,
      goodEvents,
      minSamplesRequired: 5,
    });
  }
}
