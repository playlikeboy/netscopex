import { describe, it, expect, vi } from "vitest";
import { evaluateMonitorStateTransition } from "../../apps/worker/src/state-evaluator.js";
import { MonitorConfig, ProbeResult } from "@netscopex/contracts";

describe("Monitor Lifecycle State Machine & Incident Transitions", () => {
  const baseMonitor: MonitorConfig = {
    id: "00000000-0000-0000-0000-000000000001",
    projectId: "00000000-0000-0000-0000-000000000001",
    name: "Test Service",
    url: "https://example.com/health",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 5000,
    expectedStatusCodes: [200],
    headers: {},
    state: "unknown",
    degradedThresholdCount: 2,
    downThresholdCount: 3,
    recoveryThresholdCount: 2,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    consecutiveDegraded: 0,
    degradedLatencyThresholdMs: 2000,
    probeRegionPreference: ["us-east-local"],
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const createMockProbeResult = (success: boolean, durationMs = 150): ProbeResult => ({
    id: "res-001",
    jobId: "job-001",
    monitorId: baseMonitor.id,
    probeRegion: "us-east-local",
    workerId: "worker-01",
    statusCode: success ? 200 : 500,
    success,
    timing: {
      dnsLookupMs: 10,
      tcpConnectionMs: 20,
      tlsHandshakeMs: 30,
      ttfbMs: durationMs - 40,
      contentDownloadMs: 40,
      totalDurationMs: durationMs,
    },
    headers: {},
    error: success
      ? undefined
      : { classification: "HTTP_ERROR", message: "HTTP 500 Internal Error" },
    executedAt: new Date().toISOString(),
  });

  const createMockRepos = () => {
    let currentIncident: any = null;
    return {
      monitorRepo: {
        updateState: vi.fn().mockResolvedValue(null),
      } as any,
      incidentRepo: {
        findActiveByMonitor: vi.fn().mockImplementation(async () => currentIncident),
        create: vi.fn().mockImplementation(async (data) => {
          currentIncident = { id: "inc-100", ...data, status: "TRIGGERED" };
          return currentIncident;
        }),
        addEvent: vi.fn().mockResolvedValue(null),
        resolve: vi.fn().mockImplementation(async () => {
          if (currentIncident) currentIncident.status = "RESOLVED";
          return currentIncident;
        }),
      } as any,
      notifRepo: {
        listByProject: vi.fn().mockResolvedValue([]),
        recordDeliveryAttempt: vi.fn().mockResolvedValue(true),
      } as any,
    };
  };

  it("transitions from unknown to active on first healthy check", async () => {
    const repos = createMockRepos();
    const result = await evaluateMonitorStateTransition({
      monitor: { ...baseMonitor, state: "unknown" },
      probeResult: createMockProbeResult(true),
      ...repos,
    });

    expect(result.newState).toBe("active");
    expect(result.incidentTriggered).toBe(false);
  });

  it("transitions to degraded on first transient failure without prematurely triggering an incident", async () => {
    const repos = createMockRepos();
    const result = await evaluateMonitorStateTransition({
      monitor: { ...baseMonitor, state: "active" },
      probeResult: createMockProbeResult(false),
      ...repos,
    });

    expect(result.newState).toBe("degraded");
    expect(result.incidentTriggered).toBe(false);
    expect(result.stateReason).toContain("Transient failure detected");
  });

  it("transitions to down and triggers incident when consecutive failures reach downThresholdCount (3)", async () => {
    const repos = createMockRepos();
    const result = await evaluateMonitorStateTransition({
      monitor: {
        ...baseMonitor,
        state: "degraded",
        consecutiveFailures: 2, // 3rd failure coming
      },
      probeResult: createMockProbeResult(false),
      ...repos,
    });

    expect(result.newState).toBe("down");
    expect(result.incidentTriggered).toBe(true);
    expect(repos.incidentRepo.create).toHaveBeenCalled();
  });

  it("transitions down -> recovering on first successful probe check", async () => {
    const repos = createMockRepos();
    // Simulate active incident
    repos.incidentRepo.create({
      projectId: baseMonitor.projectId,
      monitorId: baseMonitor.id,
      title: "Outage",
      consecutiveFailureCount: 3,
    });

    const result = await evaluateMonitorStateTransition({
      monitor: {
        ...baseMonitor,
        state: "down",
        consecutiveFailures: 3,
        consecutiveSuccesses: 0,
      },
      probeResult: createMockProbeResult(true),
      ...repos,
    });

    expect(result.newState).toBe("recovering");
    expect(result.incidentResolved).toBe(false);
    expect(result.stateReason).toContain("recovering");
  });

  it("transitions recovering -> active and resolves incident when recoveryThresholdCount (2) is met", async () => {
    const repos = createMockRepos();
    repos.incidentRepo.create({
      projectId: baseMonitor.projectId,
      monitorId: baseMonitor.id,
      title: "Outage",
      consecutiveFailureCount: 3,
    });

    const result = await evaluateMonitorStateTransition({
      monitor: {
        ...baseMonitor,
        state: "recovering",
        consecutiveFailures: 0,
        consecutiveSuccesses: 1, // 2nd success coming
      },
      probeResult: createMockProbeResult(true),
      ...repos,
    });

    expect(result.newState).toBe("active");
    expect(result.incidentResolved).toBe(true);
    expect(repos.incidentRepo.resolve).toHaveBeenCalled();
  });
});
