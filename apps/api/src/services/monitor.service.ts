import {
  CreateMonitorInput,
  MonitorConfig,
  UpdateMonitorInput,
} from "@netscopex/contracts";
import {
  MonitorRepository,
  ProbeJobRepository,
  ProbeResultRepository,
} from "@netscopex/database";
import { validateTargetUrl } from "@netscopex/worker";

export class MonitorService {
  private monitorRepo = new MonitorRepository();
  private jobRepo = new ProbeJobRepository();
  private resultRepo = new ProbeResultRepository();

  async listMonitors(projectId: string): Promise<MonitorConfig[]> {
    return this.monitorRepo.listByProject(projectId);
  }

  async getMonitor(id: string): Promise<MonitorConfig | null> {
    return this.monitorRepo.findById(id);
  }

  async createMonitor(
    projectId: string,
    input: CreateMonitorInput,
    allowLocalTest = true
  ): Promise<MonitorConfig> {
    // SSRF Validation
    const ssrfCheck = await validateTargetUrl(input.url, allowLocalTest);
    if (!ssrfCheck.valid) {
      throw new Error(`SSRF Validation Rejected Target: ${ssrfCheck.errorReason}`);
    }

    const monitor = await this.monitorRepo.create({
      projectId,
      name: input.name,
      url: input.url,
      method: input.method,
      intervalSeconds: input.intervalSeconds,
      timeoutMs: input.timeoutMs,
      expectedStatusCodes: input.expectedStatusCodes,
      headers: input.headers,
      body: input.body,
      degradedThresholdCount: input.degradedThresholdCount,
      downThresholdCount: input.downThresholdCount,
      recoveryThresholdCount: input.recoveryThresholdCount,
      degradedLatencyThresholdMs: input.degradedLatencyThresholdMs,
      probeRegionPreference: input.probeRegionPreference,
      tags: input.tags,
    });

    // Schedule immediate initial check
    await this.triggerCheck(monitor.id);

    return monitor;
  }

  async updateMonitor(
    id: string,
    input: UpdateMonitorInput,
    allowLocalTest = true
  ): Promise<MonitorConfig | null> {
    if (input.url) {
      const ssrfCheck = await validateTargetUrl(input.url, allowLocalTest);
      if (!ssrfCheck.valid) {
        throw new Error(`SSRF Validation Rejected Target: ${ssrfCheck.errorReason}`);
      }
    }

    return this.monitorRepo.update(id, input as any);
  }

  async deleteMonitor(id: string): Promise<boolean> {
    return this.monitorRepo.delete(id);
  }

  async triggerCheck(monitorId: string): Promise<string | null> {
    const monitor = await this.monitorRepo.findById(monitorId);
    if (!monitor) throw new Error("Monitor not found");

    return this.jobRepo.enqueue(monitor.id, new Date(), {
      url: monitor.url,
      method: monitor.method,
      headers: monitor.headers,
      body: monitor.body,
      timeoutMs: monitor.timeoutMs,
      expectedStatusCodes: monitor.expectedStatusCodes,
      degradedLatencyThresholdMs: monitor.degradedLatencyThresholdMs,
      targetRegion: monitor.probeRegionPreference[0] || "us-east-local",
    });
  }

  async getMonitorResults(monitorId: string, limit = 50) {
    return this.resultRepo.listByMonitor(monitorId, limit);
  }
}
