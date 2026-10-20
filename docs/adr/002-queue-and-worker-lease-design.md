# ADR 002: Queue and Distributed Worker Lease Design

## Status
Accepted

## Context
Distributed synthetic probe workers must pull jobs from a durable queue, process scheduled checks, and report results without missing executions or losing jobs during worker restarts or network partitions. We evaluated Redis-backed queues (BullMQ) versus PostgreSQL-backed transactional lease queues (`SELECT ... FOR UPDATE SKIP LOCKED`).

## Decision
We implemented a **PostgreSQL-backed Transactional Lease Queue** with:
1. `SELECT ... FOR UPDATE SKIP LOCKED` for concurrent batch polling.
2. Explicit `lease_owner` and `lease_expires_at` timestamps (default 30 seconds).
3. Background stale lease recovery sweepers that automatically reclaim orphaned jobs from crashed workers without manual intervention.

## Alternatives Considered
- **Redis / BullMQ:** High throughput in-memory queuing, but introduces a dual-write problem between Redis and PostgreSQL, potential data loss on unpersisted Redis crashes, and an additional infrastructure dependency.
- **RabbitMQ / Kafka:** Unnecessary operational complexity and lacks native transactional alignment with the monitor and incident database state.

## Trade-offs
- **PostgreSQL Lease Queue:** Guaranteed ACID durability, zero dual-write synchronization bugs, transactional correlation with results, and simple disaster recovery. Table vacuuming and index maintenance must be monitored at high throughput.
