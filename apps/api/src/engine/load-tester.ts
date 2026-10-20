import {
  LoadTestConfig,
  LoadTestResult,
} from "@netscopex/contracts";
import crypto from "node:crypto";
import { executeProbeRequest } from "@netscopex/worker";

export async function runControlledLoadTest(
  config: LoadTestConfig,
  allowLocalTest = true
): Promise<LoadTestResult> {
  const startedAt = new Date();
  const startTime = Date.now();
  const endTime = startTime + config.durationSeconds * 1000;

  // Hard safety limits
  const safeVUs = Math.min(config.targetVUs, 50);
  const durationsMs: number[] = [];
  let successfulRequests = 0;
  let failedRequests = 0;
  let abortReason: string | undefined;

  // Worker loop for each virtual user
  const vuTask = async () => {
    while (Date.now() < endTime && !abortReason) {
      const res = await executeProbeRequest({
        url: config.targetUrl,
        method: "GET",
        timeoutMs: Math.min(config.maxAcceptableP95Ms * 2, 8000),
        allowLocalTest,
      });

      durationsMs.push(res.timing.totalDurationMs);
      if (res.success) {
        successfulRequests++;
      } else {
        failedRequests++;
      }

      // Circuit Breaker check
      const total = successfulRequests + failedRequests;
      if (total >= 20) {
        const errorRate = (failedRequests / total) * 100;
        if (errorRate > 50) {
          abortReason = `Circuit Breaker Tripped: Error rate exceeded 50% (${errorRate.toFixed(1)}%) after ${total} requests. Test aborted for target protection.`;
          break;
        }
      }

      // Micro pacing delay
      await new Promise((r) => setTimeout(r, 20 + Math.random() * 30));
    }
  };

  // Run virtual users concurrently
  const vuPromises: Promise<void>[] = [];
  for (let i = 0; i < safeVUs; i++) {
    vuPromises.push(vuTask());
  }

  await Promise.all(vuPromises);

  const completedAt = new Date();
  const actualDurationSec = Math.max(0.1, (completedAt.getTime() - startedAt.getTime()) / 1000);
  const totalRequests = successfulRequests + failedRequests;
  const errorRatePercent = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0;

  // Calculate percentiles
  durationsMs.sort((a, b) => a - b);
  const getPercentile = (p: number) => {
    if (durationsMs.length === 0) return 0;
    const index = Math.min(
      Math.floor((p / 100) * durationsMs.length),
      durationsMs.length - 1
    );
    return durationsMs[index] || 0;
  };

  const p50Ms = Number(getPercentile(50).toFixed(2));
  const p90Ms = Number(getPercentile(90).toFixed(2));
  const p95Ms = Number(getPercentile(95).toFixed(2));
  const p99Ms = Number(getPercentile(99).toFixed(2));
  const throughputRps = Number((totalRequests / actualDurationSec).toFixed(2));

  const passed =
    !abortReason &&
    errorRatePercent <= config.maxAcceptableErrorRatePercent &&
    p95Ms <= config.maxAcceptableP95Ms;

  return {
    id: crypto.randomUUID(),
    configId: config.id,
    totalRequests,
    successfulRequests,
    failedRequests,
    errorRatePercent: Number(errorRatePercent.toFixed(2)),
    p50Ms,
    p90Ms,
    p95Ms,
    p99Ms,
    throughputRps,
    passed,
    abortReason,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
  };
}
