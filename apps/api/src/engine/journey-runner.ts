import {
  SyntheticJourney,
  JourneyStep,
} from "@netscopex/contracts";
import { executeProbeRequest } from "@netscopex/worker";

export interface StepExecutionResult {
  stepId: string;
  stepName: string;
  statusCode: number | null;
  durationMs: number;
  passed: boolean;
  failureReason?: string;
}

export interface JourneyExecutionResult {
  journeyId: string;
  passed: boolean;
  totalDurationMs: number;
  steps: StepExecutionResult[];
  failedStepIndex?: number;
}

function resolveVariables(text: string, variables: Record<string, string>): string {
  let res = text;
  for (const [key, val] of Object.entries(variables)) {
    res = res.replaceAll(`{{${key}}}`, val);
  }
  return res;
}

function getByPath(obj: any, path: string): any {
  const parts = path.split(".");
  let curr = obj;
  for (const p of parts) {
    if (curr === null || curr === undefined) return undefined;
    curr = curr[p];
  }
  return curr;
}

export async function runSyntheticJourney(
  journey: SyntheticJourney,
  allowLocalTest = true
): Promise<JourneyExecutionResult> {
  const startTime = Date.now();
  const stepResults: StepExecutionResult[] = [];
  const extractedVariables: Record<string, string> = {};
  let overallPassed = true;
  let failedStepIndex: number | undefined;

  for (let i = 0; i < journey.steps.length; i++) {
    const step = journey.steps[i];
    if (!step) continue;
    const resolvedPath = resolveVariables(step.path, extractedVariables);
    const fullUrl = new URL(resolvedPath, journey.baseUrl).toString();

    let resolvedBody = step.body;
    if (resolvedBody) {
      resolvedBody = resolveVariables(resolvedBody, extractedVariables);
    }

    const resolvedHeaders: Record<string, string> = {};
    if (step.headers) {
      for (const [k, v] of Object.entries(step.headers)) {
        resolvedHeaders[k] = resolveVariables(v, extractedVariables);
      }
    }

    const diag = await executeProbeRequest({
      url: fullUrl,
      method: step.method,
      headers: resolvedHeaders,
      body: resolvedBody,
      timeoutMs: 8000,
      allowLocalTest,
    });

    let stepPassed = true;
    let failureReason: string | undefined;

    // Check assertions
    for (const assertion of step.assertions) {
      if (assertion.type === "STATUS_CODE") {
        if (diag.statusCode !== Number(assertion.expected)) {
          stepPassed = false;
          failureReason = `Status code assertion failed: expected ${assertion.expected}, received ${diag.statusCode}`;
          break;
        }
      } else if (assertion.type === "BODY_CONTAINS") {
        if (!diag.bodyPreview?.includes(String(assertion.expected))) {
          stepPassed = false;
          failureReason = `Body substring assertion failed: expected body to contain '${assertion.expected}'`;
          break;
        }
      } else if (assertion.type === "LATENCY_LESS_THAN") {
        if (diag.timing.totalDurationMs >= Number(assertion.expected)) {
          stepPassed = false;
          failureReason = `Latency threshold assertion failed: duration ${diag.timing.totalDurationMs.toFixed(0)}ms exceeded max ${assertion.expected}ms`;
          break;
        }
      } else if (assertion.type === "JSON_PATH_EQUALS") {
        try {
          const parsed = JSON.parse(diag.bodyPreview || "{}");
          const actualVal = getByPath(parsed, assertion.target);
          if (String(actualVal) !== String(assertion.expected)) {
            stepPassed = false;
            failureReason = `JSONPath '${assertion.target}' assertion failed: expected '${assertion.expected}', received '${actualVal}'`;
            break;
          }
        } catch {
          stepPassed = false;
          failureReason = `Failed to parse JSON response body for path assertion '${assertion.target}'`;
          break;
        }
      }
    }

    // Variable extraction for next steps
    if (stepPassed && step.extractVariables && diag.bodyPreview) {
      try {
        const parsed = JSON.parse(diag.bodyPreview);
        for (const [varName, path] of Object.entries(step.extractVariables)) {
          const val = getByPath(parsed, path);
          if (val !== undefined) {
            extractedVariables[varName] = String(val);
          }
        }
      } catch {
        // Ignored if non-json
      }
    }

    stepResults.push({
      stepId: step.id,
      stepName: step.name,
      statusCode: diag.statusCode,
      durationMs: Number(diag.timing.totalDurationMs.toFixed(1)),
      passed: stepPassed,
      failureReason,
    });

    if (!stepPassed) {
      overallPassed = false;
      failedStepIndex = i;
      break; // Abort remaining dependent steps
    }
  }

  return {
    journeyId: journey.id,
    passed: overallPassed,
    totalDurationMs: Date.now() - startTime,
    steps: stepResults,
    failedStepIndex,
  };
}
