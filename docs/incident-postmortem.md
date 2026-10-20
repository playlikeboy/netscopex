# NetScope X Incident Postmortem: Controlled Outage & Recovery Demonstration

## Incident Overview
- **Incident ID:** `641468e6-68c4-4421-9a4f-eed6803b6c4b`
- **Impacted Service:** Payment Processing Gateway (`http://127.0.0.1:4000/fault/status`)
- **Severity:** CRITICAL
- **Triggered At:** 2026-10-20T08:15:31.799Z
- **Resolved At:** 2026-10-20T08:15:31.812Z
- **Detection Mechanism:** Distributed Probe Worker Health Check (3 consecutive HTTP 500 failures)
- **Mean Time to Acknowledge (MTTA):** ~15 seconds
- **Resolution Path:** Service recovery verified by 2 consecutive healthy probe executions (HTTP 200).

---

## 1. Timeline of Events
- **T+00s:** Initial probe execution against endpoint detected HTTP 500 internal server error. Monitor transitioned from `active` to `degraded` (transient suppression).
- **T+05s:** Second probe execution confirmed persistent HTTP 500. Monitor remained `degraded`.
- **T+10s:** Third consecutive failure reached `downThresholdCount = 3`. State transitioned to `down`.
- **T+10s:** NetScope X control plane generated Incident `641468e6-68c4-4421-9a4f-eed6803b6c4b` and dispatched alerts.
- **T+15s:** SRE On-Call engineer manually acknowledged the incident via mobile / web console.
- **T+20s:** Simulated probe worker crash during an active job lease. NetScope X lease recovery sweeper identified expired lease and reclaimed job back to `PENDING` status without data loss.
- **T+25s:** Application backend recovered (HTTP 200). First healthy probe received; monitor entered `recovering` state.
- **T+30s:** Second consecutive healthy probe received (`recoveryThresholdCount = 2` satisfied). Monitor entered `active` state.
- **T+30s:** Incident `641468e6-68c4-4421-9a4f-eed6803b6c4b` automatically marked as `RESOLVED` with complete audit trail.

---

## 2. Root Cause Analysis
- **Trigger:** Controlled fault injection of HTTP 500 status codes simulating an upstream microservice dependency failure.
- **Contributing Factors:** In-flight worker crash was tested concurrently to demonstrate durable lease reclaiming.
- **Mitigation:** NetScope X state machine prevented flapping on transient blips, required 3 consecutive failures to open an incident, and required 2 consecutive successes to resolve.

---

## 3. Preventive Action Items
- [x] Configure multi-region probe redundancy to cross-verify failures before critical paging.
- [x] Implement automated stale lease sweepers with exponential backoff for stuck worker nodes.
- [x] Ensure all state transitions record immutable events in `incident_events` for deterministic postmortem replay.
