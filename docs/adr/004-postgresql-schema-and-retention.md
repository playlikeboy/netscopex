# ADR 004: PostgreSQL Schema, Indexing Strategy, and Data Retention

## Status
Accepted

## Context
High-frequency probe results (e.g. checks every 10–60 seconds across hundreds of endpoints) generate significant relational data growth. We evaluated data storage models, indexing patterns, and retention strategies.

## Decision
1. **Schema Design:** Structured relational schema in PostgreSQL 16 using typed columns and JSONB for flexible sub-objects (`timing`, `headers`, `payload`).
2. **Targeted Query Indexes:**
   - `idx_monitors_project`: `(project_id, state)` for fast tenant isolation.
   - `idx_probe_jobs_poll`: `(status, scheduled_for, lease_expires_at) WHERE status IN ('PENDING', 'LEASED')` for lightning-fast queue polling without scanning completed records.
   - `idx_probe_results_monitor`: `(monitor_id, executed_at DESC)` for latency window queries.
   - `idx_probe_results_executed`: `(executed_at)` for rolling TTL purging.
3. **Data Retention Policy:**
   - Detailed raw probe executions: retained for 30 days.
   - Hourly rolling aggregate metrics: retained for 1 year.
   - Incidents and timeline events: retained indefinitely for compliance and postmortem auditability.

## Alternatives Considered
- **TimescaleDB / Partitioning:** Adding table partitioning or TimescaleDB upfront adds operational overhead without justification at initial development scale. Standard PostgreSQL with B-tree composite indexes handles millions of rows in < 15ms. Partitioning can be introduced via `pg_partman` when table size exceeds 100M rows.
