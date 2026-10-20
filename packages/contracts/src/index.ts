import { z } from "zod";

// ==========================================
// User & Auth
// ==========================================
export const UserRoleSchema = z.enum(["admin", "engineer", "viewer"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: UserRoleSchema,
  orgId: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type Organization = z.infer<typeof OrganizationSchema>;

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type Project = z.infer<typeof ProjectSchema>;

// ==========================================
// Monitor Lifecycle & Config
// ==========================================
export const MonitorLifecycleStateSchema = z.enum([
  "active",
  "paused",
  "degraded",
  "down",
  "recovering",
  "unknown",
]);
export type MonitorLifecycleState = z.infer<typeof MonitorLifecycleStateSchema>;

export const HttpMethodSchema = z.enum([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
]);
export type HttpMethod = z.infer<typeof HttpMethodSchema>;

export const MonitorConfigSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1).max(128),
  url: z.string().url(),
  method: HttpMethodSchema.default("GET"),
  intervalSeconds: z.number().int().min(5).max(3600).default(60),
  timeoutMs: z.number().int().min(500).max(30000).default(5000),
  expectedStatusCodes: z.array(z.number().int().min(100).max(599)).min(1).default([200]),
  headers: z.record(z.string()).default({}),
  body: z.string().max(65536).optional(),
  state: MonitorLifecycleStateSchema.default("unknown"),
  stateReason: z.string().optional(),
  degradedThresholdCount: z.number().int().min(1).max(10).default(2),
  downThresholdCount: z.number().int().min(1).max(10).default(3),
  recoveryThresholdCount: z.number().int().min(1).max(10).default(2),
  consecutiveFailures: z.number().int().min(0).default(0),
  consecutiveSuccesses: z.number().int().min(0).default(0),
  consecutiveDegraded: z.number().int().min(0).default(0),
  degradedLatencyThresholdMs: z.number().int().min(100).max(30000).default(2000),
  probeRegionPreference: z.array(z.string()).default(["us-east-local"]),
  tags: z.array(z.string()).default([]),
  lastCheckedAt: z.string().datetime().optional().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MonitorConfig = z.infer<typeof MonitorConfigSchema>;

export const CreateMonitorInputSchema = MonitorConfigSchema.omit({
  id: true,
  state: true,
  stateReason: true,
  consecutiveFailures: true,
  consecutiveSuccesses: true,
  consecutiveDegraded: true,
  lastCheckedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateMonitorInput = z.infer<typeof CreateMonitorInputSchema>;

export const UpdateMonitorInputSchema = CreateMonitorInputSchema.partial();
export type UpdateMonitorInput = z.infer<typeof UpdateMonitorInputSchema>;

// ==========================================
// Probe Execution & Diagnostics
// ==========================================
export const RootCauseClassificationSchema = z.enum([
  "HTTP_ERROR",
  "DNS_FAILURE",
  "TLS_ERROR",
  "TCP_CONNECTION_REFUSED",
  "TIMEOUT",
  "SSRF_BLOCKED",
  "CLIENT_NETWORK_ERROR",
  "PAYLOAD_MISMATCH",
  "UNKNOWN",
]);
export type RootCauseClassification = z.infer<typeof RootCauseClassificationSchema>;

export const ProbeTimingBreakdownSchema = z.object({
  dnsLookupMs: z.number().nonnegative(),
  tcpConnectionMs: z.number().nonnegative(),
  tlsHandshakeMs: z.number().nonnegative(),
  ttfbMs: z.number().nonnegative(),
  contentDownloadMs: z.number().nonnegative(),
  totalDurationMs: z.number().nonnegative(),
});
export type ProbeTimingBreakdown = z.infer<typeof ProbeTimingBreakdownSchema>;

export const ProbeResultSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string(),
  monitorId: z.string().uuid(),
  probeRegion: z.string(),
  workerId: z.string(),
  statusCode: z.number().int().nullable(),
  success: booleanSchema(),
  timing: ProbeTimingBreakdownSchema,
  headers: z.record(z.string()).default({}),
  bodyPreview: z.string().max(16384).optional(),
  error: z
    .object({
      classification: RootCauseClassificationSchema,
      message: z.string(),
      code: z.string().optional(),
      details: z.record(z.unknown()).optional(),
    })
    .optional(),
  executedAt: z.string().datetime(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
});
export type ProbeResult = z.infer<typeof ProbeResultSchema>;

function booleanSchema() {
  return z.boolean();
}

export const ProbeJobSchema = z.object({
  id: z.string(),
  monitorId: z.string().uuid(),
  url: z.string().url(),
  method: HttpMethodSchema,
  headers: z.record(z.string()).default({}),
  body: z.string().optional(),
  timeoutMs: z.number().int().positive(),
  expectedStatusCodes: z.array(z.number().int()),
  degradedLatencyThresholdMs: z.number().int().default(2000),
  scheduledFor: z.string().datetime(),
  leaseOwner: z.string().optional().nullable(),
  leaseExpiresAt: z.string().datetime().optional().nullable(),
  attempt: z.number().int().min(0).default(0),
  maxRetries: z.number().int().min(0).default(3),
  targetRegion: z.string().default("us-east-local"),
  traceParent: z.string().optional(),
});
export type ProbeJob = z.infer<typeof ProbeJobSchema>;

// ==========================================
// Service Level Objectives (SLOs) & Error Budgets
// ==========================================
export const SloTypeSchema = z.enum(["AVAILABILITY", "LATENCY"]);
export type SloType = z.infer<typeof SloTypeSchema>;

export const SloWindowSchema = z.enum(["1h", "24h", "7d", "30d"]);
export type SloWindow = z.infer<typeof SloWindowSchema>;

export const SloStatusSchema = z.enum([
  "COMPLIANT",
  "WARNING",
  "BREACHED",
  "INSUFFICIENT_DATA",
]);
export type SloStatus = z.infer<typeof SloStatusSchema>;

export const SloDefinitionSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  monitorId: z.string().uuid(),
  name: z.string().min(1),
  type: SloTypeSchema,
  targetPercent: z.number().min(80).max(99.999),
  window: SloWindowSchema,
  latencyThresholdMs: z.number().int().positive().optional(),
  burnRateAlertThreshold: z.number().positive().default(14.4),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SloDefinition = z.infer<typeof SloDefinitionSchema>;

export const SloCalculationResultSchema = z.object({
  sloId: z.string().uuid(),
  monitorId: z.string().uuid(),
  type: SloTypeSchema,
  window: SloWindowSchema,
  targetPercent: z.number(),
  totalEvents: z.number().int().nonnegative(),
  goodEvents: z.number().int().nonnegative(),
  badEvents: z.number().int().nonnegative(),
  sliPercent: z.number().min(0).max(100),
  errorBudgetTotalPercent: z.number().min(0).max(100),
  errorBudgetConsumedPercent: z.number().min(0),
  errorBudgetRemainingPercent: z.number(),
  burnRate: z.number().nonnegative(),
  status: SloStatusSchema,
  fastBurnDetected: z.boolean(),
  slowBurnDetected: z.boolean(),
  evaluatedAt: z.string().datetime(),
  insufficientDataReason: z.string().optional(),
});
export type SloCalculationResult = z.infer<typeof SloCalculationResultSchema>;

// ==========================================
// Incidents & Events
// ==========================================
export const IncidentStatusSchema = z.enum([
  "TRIGGERED",
  "ACKNOWLEDGED",
  "RESOLVED",
]);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

export const IncidentSeveritySchema = z.enum([
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
]);
export type IncidentSeverity = z.infer<typeof IncidentSeveritySchema>;

export const IncidentEventTypeSchema = z.enum([
  "TRIGGERED",
  "PROBE_FAILED",
  "ALERT_SENT",
  "ACKNOWLEDGED",
  "PROBE_SUCCEEDED",
  "RECOVERY_DETECTED",
  "RESOLVED",
  "COMMENT_ADDED",
]);
export type IncidentEventType = z.infer<typeof IncidentEventTypeSchema>;

export const IncidentEventSchema = z.object({
  id: z.string().uuid(),
  incidentId: z.string().uuid(),
  type: IncidentEventTypeSchema,
  payload: z.record(z.unknown()).default({}),
  timestamp: z.string().datetime(),
});
export type IncidentEvent = z.infer<typeof IncidentEventSchema>;

export const IncidentSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  monitorId: z.string().uuid(),
  title: z.string(),
  severity: IncidentSeveritySchema,
  status: IncidentStatusSchema,
  triggeredAt: z.string().datetime(),
  acknowledgedAt: z.string().datetime().optional().nullable(),
  acknowledgedBy: z.string().optional().nullable(),
  resolvedAt: z.string().datetime().optional().nullable(),
  resolvedBy: z.string().optional().nullable(),
  consecutiveFailureCount: z.number().int().nonnegative(),
  rootCauseSummary: z.string().optional().nullable(),
  lastProbeResultId: z.string().uuid().optional().nullable(),
  runbookUrl: z.string().url().optional().nullable(),
});
export type Incident = z.infer<typeof IncidentSchema>;

// ==========================================
// Performance Regression Detection
// ==========================================
export const RegressionMetricSchema = z.enum([
  "p50_latency",
  "p90_latency",
  "p95_latency",
  "p99_latency",
  "failure_rate",
  "timeout_rate",
]);
export type RegressionMetric = z.infer<typeof RegressionMetricSchema>;

export const RegressionReportSchema = z.object({
  monitorId: z.string().uuid(),
  metricName: RegressionMetricSchema,
  baselineValue: z.number(),
  comparisonValue: z.number(),
  deltaPercent: z.number(),
  baselineSampleCount: z.number().int().nonnegative(),
  comparisonSampleCount: z.number().int().nonnegative(),
  pValue: z.number().optional(),
  confidenceLevel: z.number(),
  isRegressed: z.boolean(),
  explanation: z.string(),
  evaluatedAt: z.string().datetime(),
});
export type RegressionReport = z.infer<typeof RegressionReportSchema>;

// ==========================================
// Root-Cause Assistance & Findings
// ==========================================
export const DiagnosticFindingSchema = z.object({
  id: z.string().uuid(),
  incidentId: z.string().uuid().optional(),
  monitorId: z.string().uuid(),
  category: z.enum([
    "DNS",
    "TLS",
    "TCP",
    "HTTP_5XX",
    "UPSTREAM_LATENCY",
    "NETWORK_TIMEOUT",
    "CONFIGURATION_DRIFT",
  ]),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  facts: z.array(z.string()),
  hypotheses: z.array(z.string()),
  supportingEvidence: z.array(
    z.object({
      label: z.string(),
      value: z.union([z.string(), z.number()]),
      referenceId: z.string().optional(),
    })
  ),
  recommendedActions: z.array(z.string()),
  generatedAt: z.string().datetime(),
});
export type DiagnosticFinding = z.infer<typeof DiagnosticFindingSchema>;

// ==========================================
// Controlled Load Testing
// ==========================================
export const LoadTestProfileSchema = z.enum(["SMOKE", "FIXED_LOAD", "RAMP_UP"]);
export type LoadTestProfile = z.infer<typeof LoadTestProfileSchema>;

export const LoadTestConfigSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1),
  targetUrl: z.string().url(),
  profile: LoadTestProfileSchema,
  targetVUs: z.number().int().min(1).max(50),
  durationSeconds: z.number().int().min(5).max(60),
  rampUpSeconds: z.number().int().min(0).max(30).default(5),
  maxAcceptableP95Ms: z.number().int().positive().default(1500),
  maxAcceptableErrorRatePercent: z.number().min(0).max(100).default(5),
  createdAt: z.string().datetime(),
});
export type LoadTestConfig = z.infer<typeof LoadTestConfigSchema>;

export const LoadTestResultSchema = z.object({
  id: z.string().uuid(),
  configId: z.string().uuid(),
  totalRequests: z.number().int().nonnegative(),
  successfulRequests: z.number().int().nonnegative(),
  failedRequests: z.number().int().nonnegative(),
  errorRatePercent: z.number().min(0).max(100),
  p50Ms: z.number().nonnegative(),
  p90Ms: z.number().nonnegative(),
  p95Ms: z.number().nonnegative(),
  p99Ms: z.number().nonnegative(),
  throughputRps: z.number().nonnegative(),
  passed: z.boolean(),
  abortReason: z.string().optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
});
export type LoadTestResult = z.infer<typeof LoadTestResultSchema>;

// ==========================================
// Synthetic User Journeys
// ==========================================
export const JourneyAssertionTypeSchema = z.enum([
  "STATUS_CODE",
  "BODY_CONTAINS",
  "JSON_PATH_EQUALS",
  "LATENCY_LESS_THAN",
]);
export type JourneyAssertionType = z.infer<typeof JourneyAssertionTypeSchema>;

export const JourneyAssertionSchema = z.object({
  type: JourneyAssertionTypeSchema,
  target: z.string(), // jsonpath, header name, or empty for body
  expected: z.union([z.string(), z.number()]),
});
export type JourneyAssertion = z.infer<typeof JourneyAssertionSchema>;

export const JourneyStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  method: HttpMethodSchema,
  path: z.string(),
  headers: z.record(z.string()).optional(),
  body: z.string().optional(),
  extractVariables: z.record(z.string()).optional(), // e.g. { "sessionToken": "data.token" }
  assertions: z.array(JourneyAssertionSchema).default([]),
});
export type JourneyStep = z.infer<typeof JourneyStepSchema>;

export const SyntheticJourneySchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1),
  baseUrl: z.string().url(),
  steps: z.array(JourneyStepSchema).min(1),
  intervalSeconds: z.number().int().min(30).max(3600).default(300),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SyntheticJourney = z.infer<typeof SyntheticJourneySchema>;

// ==========================================
// Notifications & Webhooks
// ==========================================
export const NotificationChannelTypeSchema = z.enum(["WEBHOOK", "EMAIL", "PUSH"]);
export type NotificationChannelType = z.infer<typeof NotificationChannelTypeSchema>;

export const NotificationChannelSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1),
  type: NotificationChannelTypeSchema,
  destination: z.string(), // url for webhook, email for email, device token for push
  secret: z.string().optional(), // for webhook HMAC signature
  enabled: z.boolean().default(true),
  createdAt: z.string().datetime(),
});
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;
