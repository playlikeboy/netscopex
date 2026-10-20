import {
  SloCalculationResult,
  SloDefinition,
  SloStatus,
} from "@netscopex/contracts";

export interface SloEvaluationInput {
  slo: SloDefinition;
  totalEvents: number;
  goodEvents: number;
  minSamplesRequired?: number;
}

export function calculateSlo(input: SloEvaluationInput): SloCalculationResult {
  const { slo, totalEvents, goodEvents, minSamplesRequired = 5 } = input;
  const targetPercent = slo.targetPercent;
  const badEvents = Math.max(0, totalEvents - goodEvents);

  // Explicit handling for insufficient data
  if (totalEvents < minSamplesRequired) {
    return {
      sloId: slo.id,
      monitorId: slo.monitorId,
      type: slo.type,
      window: slo.window,
      targetPercent,
      totalEvents,
      goodEvents,
      badEvents,
      sliPercent: totalEvents > 0 ? (goodEvents / totalEvents) * 100 : 0,
      errorBudgetTotalPercent: Number((100 - targetPercent).toFixed(3)),
      errorBudgetConsumedPercent: 0,
      errorBudgetRemainingPercent: 100,
      burnRate: 0,
      status: "INSUFFICIENT_DATA",
      fastBurnDetected: false,
      slowBurnDetected: false,
      evaluatedAt: new Date().toISOString(),
      insufficientDataReason: `Insufficient sample volume: recorded ${totalEvents} checks, but at least ${minSamplesRequired} are required for statistical validity.`,
    };
  }

  const sliPercent = Number(((goodEvents / totalEvents) * 100).toFixed(4));
  const permittedErrorRate = (100 - targetPercent) / 100;
  const observedErrorRate = badEvents / totalEvents;

  const errorBudgetTotalPercent = Number((100 - targetPercent).toFixed(4));
  const errorBudgetConsumedPercent =
    permittedErrorRate > 0
      ? Number(((observedErrorRate / permittedErrorRate) * 100).toFixed(2))
      : 0;
  const errorBudgetRemainingPercent = Number(
    (100 - errorBudgetConsumedPercent).toFixed(2)
  );

  const burnRate =
    permittedErrorRate > 0
      ? Number((observedErrorRate / permittedErrorRate).toFixed(2))
      : 0;

  let status: SloStatus = "COMPLIANT";
  if (sliPercent < targetPercent) {
    status = "BREACHED";
  } else if (errorBudgetRemainingPercent <= 20 && errorBudgetRemainingPercent > 0) {
    status = "WARNING";
  }

  // SRE Multiwindow Burn Rate logic
  // Fast burn: 14.4x rate drains 2% of budget in 1 hour
  const fastBurnThreshold = slo.burnRateAlertThreshold || 14.4;
  const fastBurnDetected = burnRate >= fastBurnThreshold;

  // Slow burn: 6x rate drains 5% of budget in 6 hours
  const slowBurnDetected = burnRate >= 6.0;

  return {
    sloId: slo.id,
    monitorId: slo.monitorId,
    type: slo.type,
    window: slo.window,
    targetPercent,
    totalEvents,
    goodEvents,
    badEvents,
    sliPercent,
    errorBudgetTotalPercent,
    errorBudgetConsumedPercent,
    errorBudgetRemainingPercent,
    burnRate,
    status,
    fastBurnDetected,
    slowBurnDetected,
    evaluatedAt: new Date().toISOString(),
  };
}
