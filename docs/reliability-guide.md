# NetScope X SRE Reliability & Operations Guide

## 1. Architectural Invariants
NetScope X is engineered with specific reliability invariants to ensure deterministic, fault-tolerant operation:
1. **Durable Scheduling:** Every scheduled probe check has a deterministic identifier `job_{monitorId}_{epoch}`. Duplicate scheduler ticks cannot create duplicate logical work.
2. **At-Least-Once Delivery Safety:** If a worker crashes mid-probe, the job's lease expires after 30 seconds and is automatically reclaimed by the stale lease sweeper.
3. **No Flapping Cascades:** A transient failure never immediately opens a critical incident. Configurable thresholds (`downThresholdCount`, default 3) require persistent failure evidence before opening an incident.
4. **Idempotent Incident Lifecycle:** Only one active incident (`TRIGGERED` or `ACKNOWLEDGED`) can exist per monitor at any time. Old delayed probe results cannot reopen resolved incidents.

---

## 2. Failure Modes & Self-Healing Behaviors

### Failure Mode 1: Worker Process Crash Mid-Execution
- **Symptom:** Worker node terminates unexpectedly (OOM, host restart, SIGKILL).
- **Impact:** In-flight probe jobs remain in `status = 'LEASED'`.
- **Automatic Recovery:**
  - Every 30 seconds, the NetScope X background sweeper executes:
    ```sql
    UPDATE probe_jobs
    SET status = 'PENDING', lease_owner = NULL, lease_expires_at = NULL
    WHERE status = 'LEASED' AND lease_expires_at < NOW();
    ```
  - Healthy active workers automatically lease the reclaimed jobs. No scheduled checks are lost.

### Failure Mode 2: Flapping Upstream Targets
- **Symptom:** Target alternating between HTTP 200 and HTTP 503 every few seconds.
- **Impact:** Could trigger alarm storms and rapid open/close incident cycles.
- **Mitigation:**
  - The state machine requires `downThresholdCount = 3` consecutive failures before transitioning to `down`.
  - While oscillating, monitor state is held in `degraded` with reason `"Transient failure detected"`.
  - To resolve an incident, `recoveryThresholdCount = 2` consecutive successful probes are strictly required.

### Failure Mode 3: Database Connection Pool Saturation
- **Symptom:** Query latency increases, pool timeout errors.
- **Monitoring & Alerts:**
  - Query durations exceeding 1,000ms emit structured warnings via Pino logger.
  - Health endpoint (`/ready`) returns HTTP 503 if database connection cannot be acquired within 5 seconds.

---

## 3. Operator Runbooks

### Runbook A: Investigating an Active Incident
1. Open the Web Dashboard at `/incidents` or the Expo Mobile App under **Incidents**.
2. Click on the active incident and review the **Observed Facts** and **Inferred Hypotheses** in the Root Cause Diagnosis card.
3. Check the **Gantt Timing Breakdown** on the monitor:
   - High DNS lookup: Nameserver or DNS resolution failure.
   - High TCP connection: Network firewall, routing, or port closed.
   - High TLS handshake: Certificate renewal or cipher mismatch.
   - High TTFB: Upstream backend compute or database bottleneck.
4. Click **Acknowledge** to signal active triage.
5. Once target service is restored, observe automatic verification in the **Incident Replay View** transitioning through `recovering` to `active` and auto-resolution.
6. Export the **Post-Incident Report (PIR)** for retrospectives.

### Runbook B: Verifying Worker Cluster Health
- Navigate to `/system` on the Web Dashboard.
- Verify that registered worker nodes have reported heartbeats within the last 45 seconds.
- Scrape operational Prometheus metrics at `http://localhost:4000/metrics`.
