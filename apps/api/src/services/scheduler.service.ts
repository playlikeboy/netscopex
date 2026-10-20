import {
  MonitorRepository,
  ProbeJobRepository,
} from "@netscopex/database";
import { logger, metrics, withSpan } from "@netscopex/observability";

export class SchedulerService {
  private monitorRepo = new MonitorRepository();
  private jobRepo = new ProbeJobRepository();
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  start(intervalMs = 5000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info({ intervalMs }, "Starting NetScope X Monitor Scheduler...");

    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        logger.error({ err }, "Error during scheduler tick");
      });
    }, intervalMs);

    // Initial immediate tick
    this.tick().catch((err) => {
      logger.error({ err }, "Error during initial scheduler tick");
    });
  }

  async tick(): Promise<number> {
    return withSpan("scheduler.tick", async (span) => {
      const dueMonitors = await this.monitorRepo.findDueForCheck(100);
      span.setAttribute("monitors.due_count", dueMonitors.length);

      let enqueuedCount = 0;
      const now = new Date();

      for (const monitor of dueMonitors) {
        try {
          const targetRegion =
            monitor.probeRegionPreference[
              Math.floor(Math.random() * monitor.probeRegionPreference.length)
            ] || "us-east-local";

          const jobId = await this.jobRepo.enqueue(monitor.id, now, {
            url: monitor.url,
            method: monitor.method,
            headers: monitor.headers,
            body: monitor.body,
            timeoutMs: monitor.timeoutMs,
            expectedStatusCodes: monitor.expectedStatusCodes,
            degradedLatencyThresholdMs: monitor.degradedLatencyThresholdMs,
            targetRegion,
          });

          if (jobId) {
            enqueuedCount++;
          }
        } catch (err) {
          logger.error({ err, monitorId: monitor.id }, "Failed to schedule monitor check");
        }
      }

      if (enqueuedCount > 0) {
        logger.debug({ enqueuedCount }, "Enqueued probe jobs for execution");
      }

      // Update queue depth metric
      const stats = await this.jobRepo.getQueueStats();
      metrics.setGauge("queue_depth_gauge", stats.pending, { state: "pending" });
      metrics.setGauge("queue_depth_gauge", stats.leased, { state: "leased" });

      return enqueuedCount;
    });
  }

  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info("Scheduler stopped");
  }
}
