# ADR 001: Modular Monolith Control Plane vs Microservices

## Status
Accepted

## Context
NetScope X serves as an observability control plane responsible for monitor configuration, scheduling, telemetry persistence, incident management, and reporting. We evaluated whether to split the control plane into independent microservices (e.g. auth-service, scheduling-service, incident-service, slo-service) or build a modular monolith with decoupled internal domain boundaries.

## Decision
We adopted a **Modular Monolith** architecture for the control plane (Fastify + TypeScript) with clean domain module separation (`apps/api/src/services/` and `apps/api/src/engine/`), while keeping the Probe Execution Layer (`apps/worker`) as an independently scalable distributed worker process.

## Consequences & Trade-offs
### Positive:
- **Zero Distributed Transaction Complexity:** Database operations across monitors, incidents, and schedules participate in single ACID PostgreSQL transactions without needing two-phase commit (2PC) or Sagas.
- **Low Operational Overhead:** Single deployment unit for the control plane, simplifying local development, CI/CD pipelines, and resource utilization.
- **Strict In-Process Interfaces:** Business logic is kept completely out of HTTP route handlers, enabling future extraction if independent scaling demands require it.

### Negative:
- Horizontal scaling scales the entire API server rather than individual sub-modules. However, because heavy network I/O is offloaded to probe workers, API CPU/memory demands remain low.
