import { describe, it, expect } from "vitest";
import { calculateSlo } from "../../apps/api/src/engine/slo-calculator.js";
import { SloDefinition } from "@netscopex/contracts";

describe("SLO & Error Budget Calculation Engine", () => {
  const sampleSlo: SloDefinition = {
    id: "slo-1234-5678",
    projectId: "proj-1",
    monitorId: "mon-1",
    name: "API 99.9% Availability",
    type: "AVAILABILITY",
    targetPercent: 99.9,
    window: "30d",
    burnRateAlertThreshold: 14.4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("calculates exact 99.9% compliance when 999 of 1000 events are good", () => {
    const res = calculateSlo({
      slo: sampleSlo,
      totalEvents: 1000,
      goodEvents: 999,
      minSamplesRequired: 5,
    });

    expect(res.sliPercent).toBe(99.9);
    expect(res.status).toBe("COMPLIANT");
    expect(res.errorBudgetTotalPercent).toBe(0.1);
    expect(res.errorBudgetConsumedPercent).toBe(100);
    expect(res.errorBudgetRemainingPercent).toBe(0);
    expect(res.burnRate).toBe(1.0);
    expect(res.fastBurnDetected).toBe(false);
  });

  it("detects breached SLO and consumed error budget when error rate exceeds budget", () => {
    // Permitted error rate for 99.9% is 0.1% (1 bad event per 1000).
    // If there are 5 bad events per 1000, observed error rate is 0.5% (5x the budget).
    const res = calculateSlo({
      slo: sampleSlo,
      totalEvents: 1000,
      goodEvents: 995,
      minSamplesRequired: 5,
    });

    expect(res.sliPercent).toBe(99.5);
    expect(res.status).toBe("BREACHED");
    expect(res.burnRate).toBe(5.0);
    expect(res.errorBudgetConsumedPercent).toBe(500);
    expect(res.errorBudgetRemainingPercent).toBe(-400);
    expect(res.fastBurnDetected).toBe(false);
  });

  it("triggers Fast Burn Alert when burn rate >= 14.4x (2% budget consumed in 1 hour)", () => {
    // 15 bad events per 1000 = 1.5% error rate. Permitted = 0.1%.
    // Burn rate = 1.5 / 0.1 = 15.0x >= 14.4x
    const res = calculateSlo({
      slo: sampleSlo,
      totalEvents: 1000,
      goodEvents: 985,
      minSamplesRequired: 5,
    });

    expect(res.burnRate).toBe(15.0);
    expect(res.fastBurnDetected).toBe(true);
    expect(res.slowBurnDetected).toBe(true);
  });

  it("handles insufficient sample counts explicitly without falsely claiming 100% compliance", () => {
    const res = calculateSlo({
      slo: sampleSlo,
      totalEvents: 2,
      goodEvents: 2,
      minSamplesRequired: 5,
    });

    expect(res.status).toBe("INSUFFICIENT_DATA");
    expect(res.insufficientDataReason).toContain("Insufficient sample volume");
  });

  it("evaluates latency-based SLOs correctly", () => {
    const latencySlo: SloDefinition = {
      id: "slo-lat-01",
      projectId: "proj-1",
      monitorId: "mon-2",
      name: "Checkout 95% Latency < 400ms",
      type: "LATENCY",
      targetPercent: 95.0,
      window: "7d",
      latencyThresholdMs: 400,
      burnRateAlertThreshold: 6.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 100 total events, 96 within 400ms threshold -> 96.0% compliance
    const res = calculateSlo({
      slo: latencySlo,
      totalEvents: 100,
      goodEvents: 96,
      minSamplesRequired: 5,
    });

    expect(res.sliPercent).toBe(96.0);
    expect(res.errorBudgetTotalPercent).toBe(5.0);
    // Bad events = 4. Observed error = 4%. Permitted = 5%. Consumed = 4/5 = 80%. Remaining = 20%.
    expect(res.errorBudgetConsumedPercent).toBe(80);
    expect(res.errorBudgetRemainingPercent).toBe(20);
    expect(res.status).toBe("WARNING"); // remaining <= 20%
  });
});
