# NetScope X System Architecture & Data Flow

## 1. High-Level Component Boundaries

```mermaid
graph TD
    subgraph Clients["Clients"]
        Mobile["Expo Mobile App (iOS / Android / Web)"]
        WebDash["Next.js Web Operational Dashboard"]
    end

    subgraph ControlPlane["NetScope X Control Plane (Fastify Modular Monolith)"]
        API["REST / JSON API & Routing"]
        AuthModule["Auth & RBAC Service"]
        MonitorService["Monitor Config & Trigger Service"]
        Scheduler["Durable Job Scheduler"]
        IncidentService["Incident & Replay Service"]
        SloService["SLO & Error Budget Engine"]
        DiagEngine["Evidence-Based Diagnosis Engine"]
        LoadTester["Bounded Load Test Engine"]
    end

    subgraph Persistence["Durable Persistence Layer"]
        Postgres[("PostgreSQL 16 (ACID)\n- monitors\n- probe_jobs (Lease Queue)\n- probe_results\n- incidents & events\n- slos\n- workers")]
    end

    subgraph WorkerPool["Distributed Probe Execution Layer"]
        Worker1["Probe Worker 1 (us-east-local)"]
        Worker2["Probe Worker 2 (eu-west-1)"]
        Sweeper["Stale Lease Recovery Sweeper"]
    end

    subgraph External["External Network"]
        TargetAPI["Target Service Endpoints"]
        Webhooks["Customer Notification Webhooks"]
    end

    Mobile -->|"REST / TanStack Query"| API
    WebDash -->|"REST / Live 5s Poll"| API
    API -->|"Typed Queries & Pool"| Postgres
    Scheduler -->|"Enqueue Scheduled Jobs"| Postgres
    Worker1 -->|"SELECT FOR UPDATE SKIP LOCKED"| Postgres
    Worker2 -->|"SELECT FOR UPDATE SKIP LOCKED"| Postgres
    Sweeper -->|"Reclaim Expired Leases"| Postgres
    Worker1 -->|"SSRF Validated HTTP Probe"| TargetAPI
    Worker2 -->|"SSRF Validated HTTP Probe"| TargetAPI
    API -->|"HMAC-SHA256 Signed Alerts"| Webhooks
```

---

## 2. Monitoring Job & Result Lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant S as Scheduler
    participant DB as PostgreSQL (probe_jobs)
    participant W as Probe Worker
    participant T as Target Endpoint
    participant SM as State Evaluator
    participant INC as Incident System

    S->>DB: Enqueue probe job (UNIQUE on monitor_id + epoch)
    loop Every 1 second
        W->>DB: pollAndLease(workerId, region, batchSize) FOR UPDATE SKIP LOCKED
        DB-->>W: Leased job records (status = 'LEASED')
    end
    W->>W: Validate URL against SSRF (DNS + Socket IP)
    W->>T: Execute HTTP Probe (Measure DNS, TCP, TLS, TTFB, Total)
    T-->>W: Response or Structured Error
    W->>DB: Insert probe_result (UNIQUE on job_id)
    W->>DB: Mark probe_job COMPLETED
    W->>SM: Evaluate State Transitions (consecutive failures / successes)
    alt 3 Consecutive Failures
        SM->>INC: Trigger Incident (CRITICAL)
        INC->>DB: Insert incident + TRIGGERED event
    else 2 Consecutive Successes after Outage
        SM->>INC: Auto-Resolve Incident
        INC->>DB: Mark incident RESOLVED + RESOLVED event
    end
```

---

## 3. Monitor Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> unknown: Monitor Created
    unknown --> active: First Successful Probe
    unknown --> degraded: First Transient Failure

    active --> degraded: 1-2 Consecutive Failures
    active --> degraded: Latency > Degraded Threshold (consecutive)
    active --> active: Healthy Probe

    degraded --> down: 3 Consecutive Failures (Breaches downThreshold)
    degraded --> recovering: 1 Successful Probe
    
    down --> recovering: 1 Successful Probe
    down --> down: Ongoing Failure (Appends PROBE_FAILED event)

    recovering --> active: 2nd Consecutive Success (Auto-Resolves Incident)
    recovering --> down: Probe Fails

    active --> paused: User Pauses Monitor
    paused --> active: User Resumes Monitor
```

---

## 4. Worker Crash & Automatic Lease Recovery

```mermaid
sequenceDiagram
    autonumber
    participant W1 as Worker 1 (Failing)
    participant DB as PostgreSQL Queue
    participant SW as Lease Sweeper
    participant W2 as Worker 2 (Healthy)

    W1->>DB: Lease job_42 (lease_expires_at = T+30s)
    Note over W1: Worker 1 crashes (SIGKILL / OOM)
    Note over DB: Time passes... clock reaches T+31s
    SW->>DB: recoverStaleLeases() (WHERE status='LEASED' AND lease_expires_at < NOW())
    DB-->>SW: Reclaimed job_42 back to 'PENDING'
    W2->>DB: pollAndLease() FOR UPDATE SKIP LOCKED
    DB-->>W2: Leased job_42
    W2->>W2: Execute Probe & Persist Result
    W2->>DB: Mark job_42 COMPLETED
```
