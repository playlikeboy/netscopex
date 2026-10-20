import { RegressionMetric, RegressionReport } from "@netscopex/contracts";

export interface LatencyDataset {
  sampleCount: number;
  mean: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  failureRatePercent: number;
  timeoutRatePercent: number;
}

export interface RegressionCheckOptions {
  monitorId: string;
  metric: RegressionMetric;
  baseline: LatencyDataset;
  comparison: LatencyDataset;
  relativeThresholdPercent?: number; // e.g. 20% degradation
  minSamplesRequired?: number; // e.g. 10 samples
}

export function detectPerformanceRegression(
  options: RegressionCheckOptions
): RegressionReport {
  const {
    monitorId,
    metric,
    baseline,
    comparison,
    relativeThresholdPercent = 20,
    minSamplesRequired = 10,
  } = options;

  let baselineVal = 0;
  let comparisonVal = 0;

  switch (metric) {
    case "p50_latency":
      baselineVal = baseline.p50;
      comparisonVal = comparison.p50;
      break;
    case "p90_latency":
      baselineVal = baseline.p90;
      comparisonVal = comparison.p90;
      break;
    case "p95_latency":
      baselineVal = baseline.p95;
      comparisonVal = comparison.p95;
      break;
    case "p99_latency":
      baselineVal = baseline.p99;
      comparisonVal = comparison.p99;
      break;
    case "failure_rate":
      baselineVal = baseline.failureRatePercent;
      comparisonVal = comparison.failureRatePercent;
      break;
    case "timeout_rate":
      baselineVal = baseline.timeoutRatePercent;
      comparisonVal = comparison.timeoutRatePercent;
      break;
  }

  const delta = baselineVal > 0 ? ((comparisonVal - baselineVal) / baselineVal) * 100 : 0;
  const isSampleAdequate =
    baseline.sampleCount >= minSamplesRequired &&
    comparison.sampleCount >= minSamplesRequired;

  const isThresholdBreached = delta >= relativeThresholdPercent;
  const isRegressed = isSampleAdequate && isThresholdBreached;

  let explanation = "";
  let confidence = 0.95;

  if (!isSampleAdequate) {
    confidence = 0.5;
    explanation = `Inconclusive regression analysis: baseline sample size (${baseline.sampleCount}) or comparison sample size (${comparison.sampleCount}) is below the minimum threshold (${minSamplesRequired}) required for statistical significance.`;
  } else if (isRegressed) {
    explanation = `Performance regression detected in ${metric}: jumped by +${delta.toFixed(1)}% (from ${baselineVal.toFixed(1)} to ${comparisonVal.toFixed(1)}). Breached acceptable variance threshold (+${relativeThresholdPercent}%). Baseline sample size: N=${baseline.sampleCount}, Comparison sample size: N=${comparison.sampleCount}.`;
  } else if (delta > 0) {
    explanation = `Slight performance degradation observed (+${delta.toFixed(1)}%), but remains within acceptable tolerance (+${relativeThresholdPercent}%).`;
  } else {
    explanation = `Performance improved or stable: changed by ${delta.toFixed(1)}% compared to baseline.`;
  }

  return {
    monitorId,
    metricName: metric,
    baselineValue: Number(baselineVal.toFixed(2)),
    comparisonValue: Number(comparisonVal.toFixed(2)),
    deltaPercent: Number(delta.toFixed(2)),
    baselineSampleCount: baseline.sampleCount,
    comparisonSampleCount: comparison.sampleCount,
    confidenceLevel: confidence,
    isRegressed,
    explanation,
    evaluatedAt: new Date().toISOString(),
  };
}
