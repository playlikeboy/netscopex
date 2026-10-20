# ADR 003: At-Least-Once Execution and Idempotency Guarantees

## Status
Accepted

## Context
In distributed systems, physical networks partition, workers crash mid-execution, and queue acknowledgments can be lost. Promising "exactly-once" execution in an asynchronous network is fundamentally flawed. We needed an architecture that safely operates under at-least-once job delivery.

## Decision
We embraced **at-least-once execution semantics** and engineered idempotency at every critical boundary:
1. **Durable Job Enqueuing:** A unique constraint on `(monitor_id, scheduled_epoch)` ensures that scheduler ticks cannot generate duplicate logical jobs for the same second.
2. **Probe Result Insertion:** `probe_results` enforces a `UNIQUE(job_id)` constraint. Duplicate writes execute an `ON CONFLICT (job_id) DO UPDATE` or no-op, preserving the original record.
3. **Incident State Machine:** A unique partial index `UNIQUE(monitor_id) WHERE status IN ('TRIGGERED', 'ACKNOWLEDGED')` guarantees that multiple failing probe results cannot open multiple concurrent incidents for the same target.
4. **Alert Notifications:** Webhooks and emails generate deterministic idempotency keys `alert_{incident_id}_{channel_id}` to prevent duplicate notification floods.

## Consequences
Duplicate queue deliveries or retried HTTP probes cannot corrupt database state, duplicate open incidents, or trigger uncontrolled alert storms.
