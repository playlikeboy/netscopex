import {
  RegressionMetric,
  RegressionReport,
} from "@netscopex/contracts";
import { ProbeResultRepository } from "@netscopex/database";
import {
  detectPerformanceRegression,
  LatencyDataset,
} from "../engine/regression-detector.js";

export class RegressionService {
  private resultRepo = new ProbeResultRepository();

  async analyzeRegression(
    monitorId: string,
    metric: RegressionMetric = "p95_latency",
    comparisonWindowMinutes = 60,
    baselineWindowHours = 24
  ): Promise<RegressionReport> {
    const now = new Date();
    const comparisonStart = new Date(
      now.getTime() - comparisonWindowMinutes * 60 * 1000
    );
    const baselineStart = new Date(
      now.getTime() - baselineWindowHours * 3600 * 1000
    );

    const [compMetrics, baseMetrics] = await Promise.all([
      this.resultRepo.getMetricsInWindow(monitorId, comparisonStart, now),
      this.resultRepo.getMetricsInWindow(monitorId, baselineStart, comparisonStart),
    ]);

    const compDataset: LatencyDataset = {
      sampleCount: compMetrics.totalCount,
      mean: compMetrics.avgLatencyMs,
      p50: compMetrics.p50LatencyMs,
      p90: compMetrics.p90LatencyMs,
      p95: compMetrics.p95LatencyMs,
      p99: compMetrics.p99LatencyMs,
      failureRatePercent:
        compMetrics.totalCount > 0
          ? (compMetrics.failureCount / compMetrics.totalCount) * 100
          : 0,
      timeoutRatePercent: 0,
    };

    const baseDataset: LatencyDataset = {
      sampleCount: baseMetrics.totalCount,
      mean: baseMetrics.avgLatencyMs,
      p50: baseMetrics.p50LatencyMs,
      p90: baseMetrics.p90LatencyMs,
      p95: baseMetrics.p95LatencyMs,
      p99: baseMetrics.p99LatencyMs,
      failureRatePercent:
        baseMetrics.totalCount > 0
          ? (baseMetrics.failureCount / baseMetrics.totalCount) * 100
          : 0,
      timeoutRatePercent: 0,
    };

    return detectPerformanceRegression({
      monitorId,
      metric,
      baseline: baseDataset,
      comparison: compDataset,
      relativeThresholdPercent: 20,
      minSamplesRequired: 5,
    });
  }
}
