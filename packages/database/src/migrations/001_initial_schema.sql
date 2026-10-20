-- NetScope X Database Schema Migration 001
-- Strict Typing, Performance Indexes, and Invariant Constraints

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(128) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'engineer',
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_project_org_slug UNIQUE (org_id, slug)
);

-- 4. Monitors
CREATE TABLE IF NOT EXISTS monitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    method VARCHAR(16) NOT NULL DEFAULT 'GET',
    interval_seconds INT NOT NULL DEFAULT 60,
    timeout_ms INT NOT NULL DEFAULT 5000,
    expected_status_codes INT[] NOT NULL DEFAULT '{200}',
    headers JSONB NOT NULL DEFAULT '{}',
    body TEXT,
    state VARCHAR(32) NOT NULL DEFAULT 'unknown',
    state_reason TEXT,
    degraded_threshold_count INT NOT NULL DEFAULT 2,
    down_threshold_count INT NOT NULL DEFAULT 3,
    recovery_threshold_count INT NOT NULL DEFAULT 2,
    consecutive_failures INT NOT NULL DEFAULT 0,
    consecutive_successes INT NOT NULL DEFAULT 0,
    consecutive_degraded INT NOT NULL DEFAULT 0,
    degraded_latency_threshold_ms INT NOT NULL DEFAULT 2000,
    probe_region_preference TEXT[] NOT NULL DEFAULT '{"us-east-local"}',
    tags TEXT[] NOT NULL DEFAULT '{}',
    last_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitors_project ON monitors(project_id, state);
CREATE INDEX IF NOT EXISTS idx_monitors_last_checked ON monitors(last_checked_at);

-- 5. Probe Jobs (Durable Queue with Lease Locking)
CREATE TABLE IF NOT EXISTS probe_jobs (
    id TEXT PRIMARY KEY,
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    scheduled_for TIMESTAMPTZ NOT NULL,
    scheduled_epoch BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    lease_owner VARCHAR(128),
    lease_expires_at TIMESTAMPTZ,
    attempt INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    target_region VARCHAR(64) NOT NULL DEFAULT 'us-east-local',
    trace_parent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_monitor_scheduled UNIQUE (monitor_id, scheduled_epoch)
);

CREATE INDEX IF NOT EXISTS idx_probe_jobs_poll ON probe_jobs(status, scheduled_for, lease_expires_at)
    WHERE status IN ('PENDING', 'LEASED');

-- 6. Probe Results
CREATE TABLE IF NOT EXISTS probe_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id TEXT NOT NULL REFERENCES probe_jobs(id) ON DELETE CASCADE,
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    probe_region VARCHAR(64) NOT NULL,
    worker_id VARCHAR(128) NOT NULL,
    status_code INT,
    success BOOLEAN NOT NULL,
    timing JSONB NOT NULL,
    headers JSONB NOT NULL DEFAULT '{}',
    body_preview TEXT,
    error JSONB,
    trace_id TEXT,
    span_id TEXT,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_probe_results_job UNIQUE (job_id)
);

CREATE INDEX IF NOT EXISTS idx_probe_results_monitor ON probe_results(monitor_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_probe_results_executed ON probe_results(executed_at);

-- 7. Incidents
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    severity VARCHAR(32) NOT NULL DEFAULT 'HIGH',
    status VARCHAR(32) NOT NULL DEFAULT 'TRIGGERED',
    consecutive_failure_count INT NOT NULL DEFAULT 0,
    root_cause_summary TEXT,
    last_probe_result_id UUID REFERENCES probe_results(id) ON DELETE SET NULL,
    runbook_url TEXT,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by VARCHAR(128),
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(128),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invariant: Only one active incident per monitor at any time
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_incident_per_monitor ON incidents(monitor_id)
    WHERE status IN ('TRIGGERED', 'ACKNOWLEDGED');
CREATE INDEX IF NOT EXISTS idx_incidents_project ON incidents(project_id, status);

-- 8. Incident Events
CREATE TABLE IF NOT EXISTS incident_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incident_events_incident ON incident_events(incident_id, timestamp ASC);

-- 9. SLOs (Service Level Objectives)
CREATE TABLE IF NOT EXISTS slos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL,
    target_percent NUMERIC(6, 3) NOT NULL,
    "window" VARCHAR(16) NOT NULL,
    latency_threshold_ms INT,
    burn_rate_alert_threshold NUMERIC(6, 2) NOT NULL DEFAULT 14.40,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slos_monitor ON slos(monitor_id);

-- 10. Workers (Registration & Heartbeats)
CREATE TABLE IF NOT EXISTS workers (
    worker_id VARCHAR(128) PRIMARY KEY,
    region VARCHAR(64) NOT NULL,
    hostname VARCHAR(255) NOT NULL,
    concurrency INT NOT NULL DEFAULT 10,
    active_jobs INT NOT NULL DEFAULT 0,
    last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(32) NOT NULL DEFAULT 'HEALTHY',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workers_heartbeat ON workers(last_heartbeat_at);

-- 11. Notification Channels
CREATE TABLE IF NOT EXISTS notification_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL,
    destination TEXT NOT NULL,
    secret TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Alert Deliveries
CREATE TABLE IF NOT EXISTS alert_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_pending ON alert_deliveries(status, attempts);

-- 13. Controlled Load Test Configs & Results
CREATE TABLE IF NOT EXISTS load_test_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    target_url TEXT NOT NULL,
    profile VARCHAR(32) NOT NULL DEFAULT 'SMOKE',
    target_vus INT NOT NULL DEFAULT 10,
    duration_seconds INT NOT NULL DEFAULT 15,
    ramp_up_seconds INT NOT NULL DEFAULT 3,
    max_acceptable_p95_ms INT NOT NULL DEFAULT 1500,
    max_acceptable_error_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
    verification_token VARCHAR(128) NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS load_test_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL REFERENCES load_test_configs(id) ON DELETE CASCADE,
    total_requests INT NOT NULL,
    successful_requests INT NOT NULL,
    failed_requests INT NOT NULL,
    error_rate_percent NUMERIC(5, 2) NOT NULL,
    p50_ms NUMERIC(8, 2) NOT NULL,
    p90_ms NUMERIC(8, 2) NOT NULL,
    p95_ms NUMERIC(8, 2) NOT NULL,
    p99_ms NUMERIC(8, 2) NOT NULL,
    throughput_rps NUMERIC(8, 2) NOT NULL,
    passed BOOLEAN NOT NULL,
    abort_reason TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Synthetic Journeys
CREATE TABLE IF NOT EXISTS synthetic_journeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    base_url TEXT NOT NULL,
    steps JSONB NOT NULL DEFAULT '[]',
    interval_seconds INT NOT NULL DEFAULT 300,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(128) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id TEXT,
    details JSONB NOT NULL DEFAULT '{}',
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(org_id, created_at DESC);
