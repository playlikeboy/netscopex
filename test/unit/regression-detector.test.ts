import { describe, it, expect } from "vitest";
import { detectPerformanceRegression } from "../../apps/api/src/engine/regression-detector.js";

describe("Performance Regression Detection Engine", () => {
  it("flags regression when comparison latency exceeds baseline by >= 20% with adequate samples", () => {
    const report = detectPerformanceRegression({
      monitorId: "mon-reg-01",
      metric: "p95_latency",
      baseline: {
        sampleCount: 100,
        mean: 180,
        p50: 150,
        p90: 210,
        p95: 220,
        p99: 300,
        failureRatePercent: 0,
        timeoutRatePercent: 0,
      },
      comparison: {
        sampleCount: 50,
        mean: 280,
        p50: 240,
        p90: 310,
        p95: 330, // 330 vs 220 = +50% increase
        p99: 450,
        failureRatePercent: 0,
        timeoutRatePercent: 0,
      },
      relativeThresholdPercent: 20,
      minSamplesRequired: 10,
    });

    expect(report.isRegressed).toBe(true);
    expect(report.deltaPercent).toBe(50);
    expect(report.confidenceLevel).toBe(0.95);
    expect(report.explanation).toContain("Performance regression detected in p95_latency: jumped by +50.0%");
  });

  it("handles small fluctuations within tolerance without false regression alarms", () => {
    const report = detectPerformanceRegression({
      monitorId: "mon-reg-02",
      metric: "p95_latency",
      baseline: {
        sampleCount: 100,
        mean: 200,
        p50: 180,
        p90: 220,
        p95: 240,
        p99: 290,
        failureRatePercent: 0,
        timeoutRatePercent: 0,
      },
      comparison: {
        sampleCount: 40,
        mean: 210,
        p50: 185,
        p90: 230,
        p95: 252, // 252 vs 240 = +5% increase (< 20%)
        p99: 300,
        failureRatePercent: 0,
        timeoutRatePercent: 0,
      },
      relativeThresholdPercent: 20,
      minSamplesRequired: 10,
    });

    expect(report.isRegressed).toBe(false);
    expect(report.deltaPercent).toBe(5);
    expect(report.explanation).toContain("remains within acceptable tolerance");
  });

  it("reports inconclusive regression analysis when sample counts are insufficient", () => {
    const report = detectPerformanceRegression({
      monitorId: "mon-reg-03",
      metric: "p95_latency",
      baseline: {
        sampleCount: 4, // < 10
        mean: 200,
        p50: 180,
        p90: 220,
        p95: 240,
        p99: 290,
        failureRatePercent: 0,
        timeoutRatePercent: 0,
      },
      comparison: {
        sampleCount: 3, // < 10
        mean: 350,
        p50: 300,
        p90: 380,
        p95: 400,
        p99: 500,
        failureRatePercent: 0,
        timeoutRatePercent: 0,
      },
      relativeThresholdPercent: 20,
      minSamplesRequired: 10,
    });

    expect(report.isRegressed).toBe(false);
    expect(report.confidenceLevel).toBe(0.5);
    expect(report.explanation).toContain("Inconclusive regression analysis");
  });
});
