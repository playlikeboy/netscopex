import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  getDbPool,
  closeDbPool,
  runMigrations,
  MonitorRepository,
  IncidentRepository,
  ProbeJobRepository,
  ProbeResultRepository,
  NotificationRepository,
} from "@netscopex/database";
import { evaluateMonitorStateTransition } from "../../apps/worker/src/state-evaluator.js";

describe("End-to-End Reliability Workflow: Monitor -> Failure -> Incident -> Recovery -> Resolution", () => {
  const monitorRepo = new MonitorRepository();
  const incidentRepo = new IncidentRepository();
  const jobRepo = new ProbeJobRepository();
  const resultRepo = new ProbeResultRepository();
  const notifRepo = new NotificationRepository();

  let projectId: string;
  let monitorId: string;

  beforeAll(async () => {
    await runMigrations();

    const orgRes = await getDbPool().query(`
      INSERT INTO organizations (name, slug)
      VALUES ('E2E Test Org', 'e2e-org-${Date.now()}')
      RETURNING id;
    `);
    const orgId = orgRes.rows[0].id;

    const projRes = await getDbPool().query(`
      INSERT INTO projects (org_id, name, slug)
      VALUES ($1, 'E2E Reliability Project', 'e2e-proj-${Date.now()}')
      RETURNING id;
    `, [orgId]);
    projectId = projRes.rows[0].id;
  });

  afterAll(async () => {
    await closeDbPool();
  });

  it("completes full outage detection, incident triage, recovery, and automated resolution cycle", async () => {
    // 1. Create Monitor
    const monitor = await monitorRepo.create({
      projectId,
      name: "Critical Payment Gateway",
      url: "https://payment.example.com/charge",
      downThresholdCount: 3,
      recoveryThresholdCount: 2,
    });
    monitorId = monitor.id;
    expect(monitor.state).toBe("unknown");

    // 2. First Healthy Check -> State becomes active
    const now1 = new Date(Date.now() - 100000);
    const jobId1 = (await jobRepo.enqueue(monitorId, now1, {
      url: monitor.url,
      method: monitor.method,
      headers: {},
      timeoutMs: 5000,
      expectedStatusCodes: [200],
      degradedLatencyThresholdMs: 2000,
    }))!;

    const passResult = await resultRepo.insert({
      jobId: jobId1,
      monitorId,
      probeRegion: "us-east-local",
      workerId: "e2e-worker",
      statusCode: 200,
      success: true,
      timing: {
        dnsLookupMs: 12,
        tcpConnectionMs: 15,
        tlsHandshakeMs: 25,
        ttfbMs: 120,
        contentDownloadMs: 20,
        totalDurationMs: 192,
      },
      headers: {},
      executedAt: new Date(),
    });

    let currentMonitor = (await monitorRepo.findById(monitorId))!;
    const trans1 = await evaluateMonitorStateTransition({
      monitor: currentMonitor,
      probeResult: passResult,
      monitorRepo,
      incidentRepo,
      notifRepo,
    });
    expect(trans1.newState).toBe("active");

    // 3. Incur 2 Transient Failures -> Monitor transitions to degraded (incident suppressed)
    for (let i = 1; i <= 2; i++) {
      currentMonitor = (await monitorRepo.findById(monitorId))!;
      const failTime = new Date(Date.now() - (10000 - i * 1000));
      const failJobId = (await jobRepo.enqueue(monitorId, failTime, {
        url: monitor.url,
        method: monitor.method,
        headers: {},
        timeoutMs: 5000,
        expectedStatusCodes: [200],
        degradedLatencyThresholdMs: 2000,
      }))!;

      const failResult = await resultRepo.insert({
        jobId: failJobId,
        monitorId,
        probeRegion: "us-east-local",
        workerId: "e2e-worker",
        statusCode: 500,
        success: false,
        timing: {
          dnsLookupMs: 10,
          tcpConnectionMs: 12,
          tlsHandshakeMs: 20,
          ttfbMs: 80,
          contentDownloadMs: 10,
          totalDurationMs: 132,
        },
        headers: {},
        error: { classification: "HTTP_ERROR", message: "HTTP 500 Server Error" },
        executedAt: new Date(),
      });

      const trans = await evaluateMonitorStateTransition({
        monitor: currentMonitor,
        probeResult: failResult,
        monitorRepo,
        incidentRepo,
        notifRepo,
      });
      expect(trans.newState).toBe("degraded");
      expect(trans.incidentTriggered).toBe(false);
    }

    // 4. Incur 3rd Consecutive Failure -> Threshold breached -> State becomes down & Incident Triggered!
    currentMonitor = (await monitorRepo.findById(monitorId))!;
    const finalFailTime = new Date(Date.now() - 5000);
    const finalFailJobId = (await jobRepo.enqueue(monitorId, finalFailTime, {
      url: monitor.url,
      method: monitor.method,
      headers: {},
      timeoutMs: 5000,
      expectedStatusCodes: [200],
      degradedLatencyThresholdMs: 2000,
    }))!;

    const finalFailResult = await resultRepo.insert({
      jobId: finalFailJobId,
      monitorId,
      probeRegion: "us-east-local",
      workerId: "e2e-worker",
      statusCode: 500,
      success: false,
      timing: {
        dnsLookupMs: 10,
        tcpConnectionMs: 12,
        tlsHandshakeMs: 20,
        ttfbMs: 80,
        contentDownloadMs: 10,
        totalDurationMs: 132,
      },
      headers: {},
      error: { classification: "HTTP_ERROR", message: "HTTP 500 Server Error" },
      executedAt: new Date(),
    });

    const trans3 = await evaluateMonitorStateTransition({
      monitor: currentMonitor,
      probeResult: finalFailResult,
      monitorRepo,
      incidentRepo,
      notifRepo,
    });

    expect(trans3.newState).toBe("down");
    expect(trans3.incidentTriggered).toBe(true);

    // Verify Incident in Database
    const activeIncident = await incidentRepo.findActiveByMonitor(monitorId);
    expect(activeIncident).not.toBeNull();
    expect(activeIncident?.status).toBe("TRIGGERED");
    expect(activeIncident?.consecutiveFailureCount).toBe(3);

    // 5. Operator Acknowledges Incident
    const acked = await incidentRepo.acknowledge(activeIncident!.id, "SRE On-Call Lead");
    expect(acked?.status).toBe("ACKNOWLEDGED");
    expect(acked?.acknowledgedBy).toBe("SRE On-Call Lead");

    // 6. Target Recovers: 1st Success -> State becomes recovering
    currentMonitor = (await monitorRepo.findById(monitorId))!;
    const recov1Time = new Date(Date.now() - 3000);
    const recov1JobId = (await jobRepo.enqueue(monitorId, recov1Time, {
      url: monitor.url,
      method: monitor.method,
      headers: {},
      timeoutMs: 5000,
      expectedStatusCodes: [200],
      degradedLatencyThresholdMs: 2000,
    }))!;

    const recov1Result = await resultRepo.insert({
      jobId: recov1JobId,
      monitorId,
      probeRegion: "us-east-local",
      workerId: "e2e-worker",
      statusCode: 200,
      success: true,
      timing: {
        dnsLookupMs: 10,
        tcpConnectionMs: 12,
        tlsHandshakeMs: 20,
        ttfbMs: 90,
        contentDownloadMs: 10,
        totalDurationMs: 142,
      },
      headers: {},
      executedAt: new Date(),
    });

    const transRecov1 = await evaluateMonitorStateTransition({
      monitor: currentMonitor,
      probeResult: recov1Result,
      monitorRepo,
      incidentRepo,
      notifRepo,
    });
    expect(transRecov1.newState).toBe("recovering");
    expect(transRecov1.incidentResolved).toBe(false);

    // 7. Target Stays Healthy: 2nd Success -> State returns to active and incident auto-resolves!
    currentMonitor = (await monitorRepo.findById(monitorId))!;
    const recov2Time = new Date(Date.now() - 1000);
    const recov2JobId = (await jobRepo.enqueue(monitorId, recov2Time, {
      url: monitor.url,
      method: monitor.method,
      headers: {},
      timeoutMs: 5000,
      expectedStatusCodes: [200],
      degradedLatencyThresholdMs: 2000,
    }))!;

    const recov2Result = await resultRepo.insert({
      jobId: recov2JobId,
      monitorId,
      probeRegion: "us-east-local",
      workerId: "e2e-worker",
      statusCode: 200,
      success: true,
      timing: {
        dnsLookupMs: 10,
        tcpConnectionMs: 12,
        tlsHandshakeMs: 20,
        ttfbMs: 85,
        contentDownloadMs: 10,
        totalDurationMs: 137,
      },
      headers: {},
      executedAt: new Date(),
    });

    const transRecov2 = await evaluateMonitorStateTransition({
      monitor: currentMonitor,
      probeResult: recov2Result,
      monitorRepo,
      incidentRepo,
      notifRepo,
    });

    expect(transRecov2.newState).toBe("active");
    expect(transRecov2.incidentResolved).toBe(true);

    // Verify Incident in DB is now RESOLVED
    const resolvedIncident = await incidentRepo.findById(activeIncident!.id);
    expect(resolvedIncident?.status).toBe("RESOLVED");
    expect(resolvedIncident?.resolvedAt).not.toBeNull();

    // Verify Timeline of Events
    const timeline = await incidentRepo.getTimeline(activeIncident!.id);
    const eventTypes = timeline.map((e) => e.type);
    expect(eventTypes).toContain("TRIGGERED");
    expect(eventTypes).toContain("ACKNOWLEDGED");
    expect(eventTypes).toContain("RECOVERY_DETECTED");
    expect(eventTypes).toContain("RESOLVED");
  });
});
