import {
  DiagnosticFinding,
  ProbeResult,
} from "@netscopex/contracts";
import crypto from "node:crypto";

export interface DiagnosisInput {
  monitorId: string;
  incidentId?: string;
  probeResult: ProbeResult;
  recentResults?: ProbeResult[];
}

export function diagnoseIncident(input: DiagnosisInput): DiagnosticFinding {
  const { monitorId, incidentId, probeResult } = input;
  const timing = probeResult.timing;
  const err = probeResult.error;
  const statusCode = probeResult.statusCode;

  const facts: string[] = [
    `Execution timestamp: ${probeResult.executedAt}`,
    `Probe Region: ${probeResult.probeRegion} (Worker: ${probeResult.workerId})`,
    `HTTP Status Code: ${statusCode !== null ? statusCode : "None (Connection failed)"}`,
    `Total probe duration: ${timing.totalDurationMs.toFixed(1)}ms (TTFB: ${timing.ttfbMs.toFixed(1)}ms, DNS: ${timing.dnsLookupMs.toFixed(1)}ms, TCP: ${timing.tcpConnectionMs.toFixed(1)}ms, TLS: ${timing.tlsHandshakeMs.toFixed(1)}ms)`,
  ];

  const supportingEvidence: Array<{
    label: string;
    value: string | number;
    referenceId?: string;
  }> = [
    { label: "Total Duration (ms)", value: timing.totalDurationMs, referenceId: probeResult.id },
    { label: "Time to First Byte (ms)", value: timing.ttfbMs, referenceId: probeResult.id },
  ];

  if (probeResult.traceId) {
    facts.push(`Correlated Distributed Trace ID: ${probeResult.traceId}`);
    supportingEvidence.push({
      label: "Trace ID",
      value: probeResult.traceId,
      referenceId: probeResult.traceId,
    });
  }

  let category: DiagnosticFinding["category"] = "UPSTREAM_LATENCY";
  let confidence: DiagnosticFinding["confidence"] = "HIGH";
  const hypotheses: string[] = [];
  const recommendedActions: string[] = [];

  if (err?.classification === "DNS_FAILURE") {
    category = "DNS";
    hypotheses.push("Authoritative nameserver unreachable or domain DNS record misconfigured.");
    recommendedActions.push("Verify domain NS records using 'dig' or 'nslookup'.");
    recommendedActions.push("Check registrar renewal status and Route53/Cloudflare nameserver health.");
  } else if (err?.classification === "TLS_ERROR") {
    category = "TLS";
    hypotheses.push(`TLS certificate handshake failed: ${err.message}`);
    recommendedActions.push("Inspect TLS certificate validity window using 'openssl s_client -connect'.");
    recommendedActions.push("Verify Automated Certificate Management Environment (ACME / Let's Encrypt) renewer.");
  } else if (err?.classification === "TCP_CONNECTION_REFUSED") {
    category = "TCP";
    hypotheses.push("Target host rejected connection: process is down or firewall/security-group is dropping traffic.");
    recommendedActions.push("Verify container/process status (systemctl, docker ps, kubectl get pods).");
    recommendedActions.push("Check cloud security groups and ingress firewall rules on port.");
  } else if (err?.classification === "TIMEOUT") {
    category = "NETWORK_TIMEOUT";
    if (timing.ttfbMs > 0) {
      hypotheses.push("Server accepted TCP connection but stalled before sending response headers (upstream backend deadlock or hung database query).");
    } else {
      hypotheses.push("Network packet loss or routing blackhole between probe worker and destination gateway.");
    }
    recommendedActions.push("Inspect backend service logs for slow database queries, thread pool exhaustion, or memory starvation.");
    recommendedActions.push("Examine reverse proxy access logs (NGINX/Envoy) for upstream timeout occurrences.");
  } else if (statusCode && [502, 503, 504].includes(statusCode)) {
    category = "HTTP_5XX";
    hypotheses.push(`Reverse proxy returned ${statusCode}: Upstream application backend is failing health checks or crashed.`);
    recommendedActions.push("Inspect application server logs behind the reverse proxy or load balancer.");
    recommendedActions.push("Check memory/CPU usage on Kubernetes pods or ECS tasks.");
  } else if (statusCode && statusCode >= 500) {
    category = "HTTP_5XX";
    hypotheses.push(`Application internal server error (${statusCode}): Unhandled exception in request handler.`);
    recommendedActions.push("Review error monitoring (Sentry/Datadog) for stack traces matching the incident timestamp.");
  } else if (timing.ttfbMs > 2000) {
    category = "UPSTREAM_LATENCY";
    hypotheses.push("Severe Time-to-First-Byte latency degradation: application processing bottleneck.");
    recommendedActions.push("Profile downstream database queries and external third-party API dependencies.");
    recommendedActions.push("Check application garbage collection pauses and thread pool saturation.");
  } else {
    hypotheses.push("Intermittent error or non-standard status returned by destination.");
    recommendedActions.push("Review endpoint documentation to confirm expected status codes and request payload semantics.");
  }

  return {
    id: crypto.randomUUID(),
    incidentId,
    monitorId,
    category,
    confidence,
    facts,
    hypotheses,
    supportingEvidence,
    recommendedActions,
    generatedAt: new Date().toISOString(),
  };
}
