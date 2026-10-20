# NetScope X — Distributed Observability & Reliability Engineering Platform

[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict_5.7-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16_ACID-336791.svg)](https://www.postgresql.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14_App_Router-black.svg)](https://nextjs.org/)
[![Expo](https://img.shields.io/badge/Expo-51_React_Native-000020.svg)](https://expo.dev/)
[![Tests](https://img.shields.io/badge/Vitest-26_Passed-brightgreen.svg)](https://vitest.dev/)

NetScope X is a serious, production-grade developer platform that combines an Expo mobile application, a Next.js operational web dashboard, a Fastify control plane API, and distributed probe execution workers. It delivers end-to-end synthetic monitoring, incident management with deterministic timeline replay, multi-window SLO error budgets, statistical regression detection, and SSRF socket-level defenses.

---

## Architecture Overview

```
netscopex/
├── apps/
│   ├── api/             # Fastify modular monolith control plane (port 4000)
│   ├── worker/          # Distributed probe workers with socket-level SSRF defenses
│   ├── web/             # Next.js 14 operational telemetry & investigation dashboard (port 3000)
│   └── mobile/          # Expo & React Native mobile client with offline persistence
├── packages/
│   ├── contracts/       # Zod schemas, domain types, and validated API contracts
│   ├── database/        # PostgreSQL typed repository layer & versioned migrations
│   ├── config/          # Zod environment variable validation
│   └── observability/   # OpenTelemetry tracing, Prometheus metrics exporter, Pino logging
├── docs/
│   ├── adr/             # Architecture Decision Records (001 - 007)
│   ├── threat-model.md  # Threat model & SSRF defense analysis
│   ├── reliability-guide.md # SRE operations & incident investigation runbooks
│   ├── incident-postmortem.md # Controlled failure demonstration postmortem
│   ├── architecture.md  # Mermaid system architecture & state machine diagrams
│   ├── benchmark-report.md # Real measured throughput and latency benchmarks
│   └── final-engineering-report.md # Comprehensive engineering report
├── test/
│   ├── unit/            # SSRF validation, SLO formulas, state machine, regression detector
│   ├── integration/     # PostgreSQL lease queue & stale worker recovery tests
│   └── e2e/             # Outage detection, incident triage, and automated resolution flow
└── scripts/             # Local infrastructure startup, benchmarks, and fault demos
```

---

## Key Engineering Capabilities

1. **Hardened HTTP Diagnostics & SSRF Protection:**
   - Pre-flight DNS resolution validating both IPv4 and IPv6 against private RFC1918, loopback, link-local, carrier-grade NAT, and cloud metadata (`169.254.169.254`).
   - Connection-time IP verification on socket `lookup` events to thwart DNS rebinding attacks.
   - Re-validation on every redirect hop (max 5 redirects).
   - Strict TLS certificate enforcement (`rejectUnauthorized: true`).
   - Precise timing breakdowns: DNS lookup, TCP connection, TLS handshake, TTFB, and content download.

2. **Durable Asynchronous Monitoring & Worker Leases:**
   - PostgreSQL-backed transactional lease queue utilizing `SELECT ... FOR UPDATE SKIP LOCKED`.
   - Bounded concurrency with worker heartbeat registration.
   - Idempotent deduplication via unique constraints on `(monitor_id, scheduled_epoch)` and `(job_id)`.
   - Background stale lease sweeper automatically reclaiming jobs from crashed workers without data loss.

3. **Deterministic Monitor Lifecycle State Machine:**
   - States: `active`, `paused`, `degraded`, `down`, `recovering`, `unknown`.
   - Configurable thresholds (`downThresholdCount`, `recoveryThresholdCount`, `degradedLatencyThresholdMs`) preventing alert flapping on transient blips.

4. **SLOs & Error Budget Intelligence:**
   - Multi-window rolling availability and latency SLO evaluations (1h, 24h, 7d, 30d).
   - Multi-window error budget burn rate calculations: Fast Burn ($BR \ge 14.4x$, 2% budget in 1 hour) and Slow Burn ($BR \ge 6.0x$).
   - Explicit `INSUFFICIENT_DATA` handling when sample volume is below statistical validity thresholds.

5. **Statistical Performance Regression Detection:**
   - Baseline window vs comparison window evaluations.
   - Evaluates p50, p90, p95, p99 latency distributions and error/timeout rates with sample size validation and confidence scoring.

6. **Incident Management & Timeline Replay:**
   - Full lifecycle: `TRIGGERED` $\to$ `ACKNOWLEDGED` $\to$ `RESOLVED`.
   - Immutable timeline of events (`incident_events`) enabling step-by-step incident replay.
   - Automated Markdown Post-Incident Report (PIR) generation.

7. **Controlled Load Testing:**
   - Bounded performance testing with hard safety limits (max 50 VUs, max 60s, max 100 RPS).
   - Automatic circuit breaker aborting tests if target error rate exceeds 50%.

8. **Synthetic User Journeys:**
   - Multi-step dependent HTTP workflows with variable extraction and assertions (`STATUS_CODE`, `BODY_CONTAINS`, `JSON_PATH_EQUALS`, `LATENCY_LESS_THAN`).

9. **Offline-Aware Mobile Client:**
   - Expo and React Native with TanStack Query and secure local persistence.
   - Offline status banners, cached indicators, and local settings. Client network drops never falsely flag remote services as down.

---

## Quickstart & Local Execution

### Prerequisites
- Node.js v22.x
- pnpm v12.x
- PostgreSQL (or run `scripts/start-local-infra.sh`)

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start Local PostgreSQL Infrastructure & Run Migrations
```bash
# Starts isolated local PostgreSQL daemon on port 54332 and prepares 'netscopex' database
pnpm dev:infra
pnpm db:migrate
pnpm db:seed
```

### 3. Run Automated Tests
```bash
# Runs full test suite (Unit, Integration, and End-to-End)
pnpm test
```

### 4. Run Reproducible Benchmarks
```bash
# Benchmarks SSRF validation, queue throughput, and PostgreSQL percentiles
pnpm benchmark
```

### 5. Run Controlled Failure & Recovery Demonstration
```bash
# Demonstrates 3 consecutive failures triggering an outage, worker lease crash recovery,
# hotfix deployment, and automatic incident resolution
pnpm fault:demo
```

### 6. Start Development Servers
```bash
# Start Control Plane API (port 4000)
pnpm --filter=@netscopex/api start

# Start Distributed Probe Worker
pnpm --filter=@netscopex/worker start

# Start Next.js Web Operational Dashboard (port 3000)
pnpm --filter=@netscopex/web dev

# Start Expo Mobile Application
pnpm --filter=@netscopex/mobile start
```
