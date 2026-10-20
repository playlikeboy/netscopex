import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { getConfig } from "@netscopex/config";
import { getDbPool } from "@netscopex/database";
import { logger, metrics } from "@netscopex/observability";
import { MonitorService } from "./services/monitor.service.js";
import { SchedulerService } from "./services/scheduler.service.js";
import { IncidentService } from "./services/incident.service.js";
import { SloService } from "./services/slo.service.js";
import { RegressionService } from "./services/regression.service.js";
import { diagnoseIncident } from "./engine/diagnosis-engine.js";
import { runControlledLoadTest } from "./engine/load-tester.js";
import { runSyntheticJourney } from "./engine/journey-runner.js";
import { WorkerRepository } from "@netscopex/database";
import { CreateMonitorInputSchema, UpdateMonitorInputSchema, LoadTestConfigSchema, SyntheticJourneySchema } from "@netscopex/contracts";

export async function createServer(): Promise<{
  app: FastifyInstance;
  scheduler: SchedulerService;
}> {
  const config = getConfig();
  const app = Fastify({
    logger: false, // Using our shared pino logger
    disableRequestLogging: true,
  });

  await app.register(cors, { origin: true });
  await app.register(helmet, { contentSecurityPolicy: false });

  const monitorService = new MonitorService();
  const schedulerService = new SchedulerService();
  const incidentService = new IncidentService();
  const sloService = new SloService();
  const regressionService = new RegressionService();
  const workerRepo = new WorkerRepository();

  // Operational & Health Endpoints
  app.get("/health", async () => ({
    status: "ok",
    service: "netscopex-api",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  }));

  app.get("/ready", async (req, reply) => {
    try {
      const pool = getDbPool();
      await pool.query("SELECT 1");
      const activeWorkers = await workerRepo.listActive(60);
      return {
        status: "ready",
        database: "connected",
        activeWorkersCount: activeWorkers.length,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      reply.status(503);
      return {
        status: "not_ready",
        database: "error",
        error: err.message,
      };
    }
  });

  app.get("/metrics", async (req, reply) => {
    reply.header("Content-Type", "text/plain; version=0.0.4");
    return metrics.toPrometheusFormat();
  });

  // ==========================================
  // Controlled Fault Injection Test Service
  // ==========================================
  app.get("/fault/status", async (req: any, reply) => {
    const code = parseInt(req.query.code || "500", 10);
    reply.status(code);
    return {
      fault: "STATUS_CODE_INJECTION",
      injectedStatusCode: code,
      message: `Injected controlled failure HTTP ${code}`,
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/fault/latency", async (req: any) => {
    const delayMs = parseInt(req.query.ms || "1000", 10);
    await new Promise((r) => setTimeout(r, delayMs));
    return {
      fault: "LATENCY_INJECTION",
      injectedDelayMs: delayMs,
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/fault/timeout", async (req, reply) => {
    // Hangs for 15 seconds to trigger client probe timeout
    await new Promise((r) => setTimeout(r, 15000));
    return { fault: "TIMEOUT_INJECTION" };
  });

  let flakyState = false;
  app.get("/fault/flaky", async (req, reply) => {
    flakyState = !flakyState;
    if (flakyState) {
      reply.status(503);
      return { fault: "FLAKY_SERVICE", status: 503, message: "Intermittent service failure" };
    }
    return { fault: "FLAKY_SERVICE", status: 200, message: "Healthy response" };
  });

  // ==========================================
  // Monitor Management Endpoints
  // ==========================================
  app.get("/api/v1/monitors", async (req: any) => {
    const projectId = req.query.projectId || "00000000-0000-0000-0000-000000000001";
    // If no project specified, list all or seed project
    const pool = getDbPool();
    const projRes = await pool.query("SELECT id FROM projects LIMIT 1");
    const activeProjId = projRes.rows[0]?.id || projectId;
    return monitorService.listMonitors(activeProjId);
  });

  app.get("/api/v1/monitors/:id", async (req: any, reply) => {
    const monitor = await monitorService.getMonitor(req.params.id);
    if (!monitor) {
      reply.status(404);
      return { error: "Monitor not found" };
    }
    return monitor;
  });

  app.post("/api/v1/monitors", async (req: any, reply) => {
    try {
      const parsed = CreateMonitorInputSchema.parse(req.body);
      const monitor = await monitorService.createMonitor(
        parsed.projectId,
        parsed,
        config.FAULT_INJECTION_ENABLED
      );
      reply.status(201);
      return monitor;
    } catch (err: any) {
      reply.status(400);
      return { error: err.message };
    }
  });

  app.put("/api/v1/monitors/:id", async (req: any, reply) => {
    try {
      const parsed = UpdateMonitorInputSchema.parse(req.body);
      const updated = await monitorService.updateMonitor(
        req.params.id,
        parsed,
        config.FAULT_INJECTION_ENABLED
      );
      if (!updated) {
        reply.status(404);
        return { error: "Monitor not found" };
      }
      return updated;
    } catch (err: any) {
      reply.status(400);
      return { error: err.message };
    }
  });

  app.delete("/api/v1/monitors/:id", async (req: any, reply) => {
    const deleted = await monitorService.deleteMonitor(req.params.id);
    if (!deleted) {
      reply.status(404);
      return { error: "Monitor not found" };
    }
    return { success: true, deletedId: req.params.id };
  });

  app.post("/api/v1/monitors/:id/trigger", async (req: any, reply) => {
    try {
      const jobId = await monitorService.triggerCheck(req.params.id);
      return { success: true, jobId, message: "Probe check scheduled for immediate execution" };
    } catch (err: any) {
      reply.status(400);
      return { error: err.message };
    }
  });

  app.get("/api/v1/monitors/:id/results", async (req: any) => {
    const limit = parseInt(req.query.limit || "50", 10);
    return monitorService.getMonitorResults(req.params.id, limit);
  });

  app.get("/api/v1/monitors/:id/regression", async (req: any) => {
    const metric = req.query.metric || "p95_latency";
    return regressionService.analyzeRegression(req.params.id, metric);
  });

  app.get("/api/v1/monitors/:id/diagnose", async (req: any, reply) => {
    const results = await monitorService.getMonitorResults(req.params.id, 1);
    if (results.length === 0) {
      reply.status(404);
      return { error: "No probe results available for diagnosis" };
    }
    return diagnoseIncident({
      monitorId: req.params.id,
      probeResult: results[0]!,
    });
  });

  // ==========================================
  // Incident Management Endpoints
  // ==========================================
  app.get("/api/v1/incidents", async (req: any) => {
    const pool = getDbPool();
    const projRes = await pool.query("SELECT id FROM projects LIMIT 1");
    const activeProjId = req.query.projectId || projRes.rows[0]?.id;
    return incidentService.listIncidents(activeProjId, req.query.status);
  });

  app.get("/api/v1/incidents/:id", async (req: any, reply) => {
    const incident = await incidentService.getIncident(req.params.id);
    if (!incident) {
      reply.status(404);
      return { error: "Incident not found" };
    }
    return incident;
  });

  app.post("/api/v1/incidents/:id/acknowledge", async (req: any, reply) => {
    const user = req.body?.user || "SRE On-Call";
    const incident = await incidentService.acknowledge(req.params.id, user);
    if (!incident) {
      reply.status(404);
      return { error: "Incident not found or already acknowledged/resolved" };
    }
    return incident;
  });

  app.post("/api/v1/incidents/:id/resolve", async (req: any, reply) => {
    const user = req.body?.user || "SRE On-Call";
    const reason = req.body?.reason || "Target recovered and passing all health checks";
    const incident = await incidentService.resolve(req.params.id, user, reason);
    if (!incident) {
      reply.status(404);
      return { error: "Incident not found or already resolved" };
    }
    return incident;
  });

  app.get("/api/v1/incidents/:id/timeline", async (req: any) => {
    return incidentService.getTimeline(req.params.id);
  });

  app.get("/api/v1/incidents/:id/replay", async (req: any) => {
    return incidentService.getReplay(req.params.id);
  });

  app.get("/api/v1/incidents/:id/report", async (req: any, reply) => {
    const report = await incidentService.generatePostIncidentReport(req.params.id);
    reply.header("Content-Type", "text/markdown");
    return report;
  });

  // ==========================================
  // SLO Management Endpoints
  // ==========================================
  app.get("/api/v1/slos", async (req: any) => {
    const pool = getDbPool();
    const projRes = await pool.query("SELECT id FROM projects LIMIT 1");
    const activeProjId = req.query.projectId || projRes.rows[0]?.id;
    return sloService.listSlos(activeProjId);
  });

  app.get("/api/v1/slos/:id/evaluate", async (req: any) => {
    return sloService.evaluateSlo(req.params.id);
  });

  // ==========================================
  // Controlled Load Testing Endpoints
  // ==========================================
  app.post("/api/v1/load-tests/run", async (req: any, reply) => {
    try {
      const parsed = LoadTestConfigSchema.parse(req.body);
      const result = await runControlledLoadTest(parsed, config.FAULT_INJECTION_ENABLED);
      return result;
    } catch (err: any) {
      reply.status(400);
      return { error: err.message };
    }
  });

  // ==========================================
  // Synthetic Journey Endpoints
  // ==========================================
  app.post("/api/v1/journeys/run", async (req: any, reply) => {
    try {
      const parsed = SyntheticJourneySchema.parse(req.body);
      const result = await runSyntheticJourney(parsed, config.FAULT_INJECTION_ENABLED);
      return result;
    } catch (err: any) {
      reply.status(400);
      return { error: err.message };
    }
  });

  // ==========================================
  // Probe Workers Cluster Health
  // ==========================================
  app.get("/api/v1/workers", async () => {
    return workerRepo.listActive(60);
  });

  return { app, scheduler: schedulerService };
}

if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  const config = getConfig();
  createServer().then(({ app, scheduler }) => {
    app.listen({ port: config.PORT, host: config.HOST }, (err, address) => {
      if (err) {
        logger.fatal({ err }, "API Server failed to start");
        process.exit(1);
      }
      logger.info({ address }, "NetScope X Control Plane API Server listening");
      scheduler.start(5000);
    });
  });
}
