import os from "node:os";
import { getConfig } from "@netscopex/config";
import {
  ProbeJobRepository,
  ProbeResultRepository,
  WorkerRepository,
  MonitorRepository,
  IncidentRepository,
  NotificationRepository,
} from "@netscopex/database";
import { logger, metrics, withSpan } from "@netscopex/observability";
import { executeProbeRequest } from "./client/http-client.js";
import { evaluateMonitorStateTransition } from "./state-evaluator.js";

export class ProbeWorker {
  private config = getConfig();
  private jobRepo = new ProbeJobRepository();
  private resultRepo = new ProbeResultRepository();
  private workerRepo = new WorkerRepository();
  private monitorRepo = new MonitorRepository();
  private incidentRepo = new IncidentRepository();
  private notifRepo = new NotificationRepository();

  private isRunning = false;
  private activeJobsCount = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private sweepTimer: NodeJS.Timeout | null = null;

  async start(): Promise<void> {
    this.isRunning = true;
    logger.info(
      {
        workerId: this.config.WORKER_ID,
        region: this.config.PROBE_REGION,
        concurrency: this.config.WORKER_CONCURRENCY,
      },
      "Starting NetScope X Distributed Probe Worker..."
    );

    // Initial heartbeat
    await this.sendHeartbeat();
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), 10000);

    // Stale lease sweeper (runs every 30 seconds)
    this.sweepTimer = setInterval(async () => {
      try {
        await this.jobRepo.recoverStaleLeases();
      } catch (err) {
        logger.error({ err }, "Error running stale lease recovery sweep");
      }
    }, 30000);

    // Main polling loop
    this.pollLoop();
  }

  private async sendHeartbeat(): Promise<void> {
    try {
      await this.workerRepo.upsertHeartbeat({
        workerId: this.config.WORKER_ID,
        region: this.config.PROBE_REGION,
        hostname: os.hostname(),
        concurrency: this.config.WORKER_CONCURRENCY,
        activeJobs: this.activeJobsCount,
      });
      metrics.setGauge("active_workers_gauge", 1, { region: this.config.PROBE_REGION });
    } catch (err) {
      logger.error({ err }, "Failed to send worker heartbeat");
    }
  }

  private async pollLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        const availableSlots = this.config.WORKER_CONCURRENCY - this.activeJobsCount;
        if (availableSlots > 0) {
          const jobs = await this.jobRepo.pollAndLease(
            this.config.WORKER_ID,
            this.config.PROBE_REGION,
            availableSlots,
            this.config.WORKER_LEASE_DURATION_MS
          );

          if (jobs.length > 0) {
            for (const job of jobs) {
              this.activeJobsCount++;
              this.processJob(job).finally(() => {
                this.activeJobsCount--;
              });
            }
          }
        }
      } catch (err) {
        logger.error({ err }, "Error during queue polling loop");
      }

      // Small jittered delay to prevent polling thundering herds
      const jitter = Math.floor(Math.random() * 200);
      await new Promise((resolve) =>
        setTimeout(resolve, this.config.WORKER_POLL_INTERVAL_MS + jitter)
      );
    }
  }

  async processJob(job: {
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
  }): Promise<void> {
    return withSpan(
      "probe.execute",
      async (span) => {
        span.setAttribute("job.id", job.id);
        span.setAttribute("monitor.id", job.monitorId);
        span.setAttribute("target.url", job.url);
        span.setAttribute("worker.region", this.config.PROBE_REGION);

        logger.info(
          { jobId: job.id, monitorId: job.monitorId, url: job.url },
          "Executing scheduled probe check"
        );

        const allowLocal =
          this.config.FAULT_INJECTION_ENABLED ||
          job.url.includes("127.0.0.1") ||
          job.url.includes("localhost");

        const diag = await executeProbeRequest({
          url: job.url,
          method: job.method as any,
          headers: job.headers,
          body: job.body,
          timeoutMs: job.timeoutMs,
          expectedStatusCodes: job.expectedStatusCodes,
          allowLocalTest: allowLocal,
        });

        const spanContext = span.spanContext();

        // Save result
        const savedResult = await this.resultRepo.insert({
          jobId: job.id,
          monitorId: job.monitorId,
          probeRegion: this.config.PROBE_REGION,
          workerId: this.config.WORKER_ID,
          statusCode: diag.statusCode,
          success: diag.success,
          timing: diag.timing,
          headers: diag.headers,
          bodyPreview: diag.bodyPreview,
          error: diag.error,
          traceId: spanContext.traceId,
          spanId: spanContext.spanId,
          executedAt: new Date(),
        });

        // Mark job completed
        await this.jobRepo.completeJob(job.id, this.config.WORKER_ID);

        // Record metrics
        metrics.incCounter("probe_executions_total", 1, {
          region: this.config.PROBE_REGION,
          status: diag.success ? "success" : "failure",
          classification: diag.error?.classification || "SUCCESS",
        });
        metrics.observeHistogram(
          "probe_duration_seconds",
          diag.timing.totalDurationMs / 1000
        );

        // Evaluate Monitor State Transitions and Incidents
        const monitor = await this.monitorRepo.findById(job.monitorId);
        if (monitor) {
          await evaluateMonitorStateTransition({
            monitor,
            probeResult: savedResult,
            monitorRepo: this.monitorRepo,
            incidentRepo: this.incidentRepo,
            notifRepo: this.notifRepo,
          });
        }
      },
      { "worker.id": this.config.WORKER_ID }
    );
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.sweepTimer) clearInterval(this.sweepTimer);

    logger.info("Gracefully stopping worker, draining in-flight jobs...");
    const timeout = Date.now() + 10000;
    while (this.activeJobsCount > 0 && Date.now() < timeout) {
      await new Promise((r) => setTimeout(r, 200));
    }
    logger.info("Worker stopped successfully");
  }
}

if (process.argv[1]?.endsWith("worker.ts") || process.argv[1]?.endsWith("worker.js")) {
  const worker = new ProbeWorker();
  worker.start().catch((err) => {
    logger.fatal({ err }, "Worker fatal crash on startup");
    process.exit(1);
  });

  const handleShutdown = async () => {
    await worker.stop();
    process.exit(0);
  };

  process.on("SIGINT", handleShutdown);
  process.on("SIGTERM", handleShutdown);
}
