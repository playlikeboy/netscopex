# ADR 007: Probe Execution Worker Deployment Model

## Status
Accepted

## Context
Synthetic monitoring requires executing HTTP checks against remote endpoints and recording accurate origin regions. We evaluated deploying probe execution within the API process versus independent distributed probe worker pools.

## Decision
We established an **Independent Distributed Worker Architecture**:
1. Workers run as standalone Node.js processes (`apps/worker`) configured with a specific geographic region identifier (`PROBE_REGION`, e.g. `us-east-local`, `eu-west-1`).
2. Workers register in the database and transmit heartbeats every 10 seconds.
3. Every probe result records the actual worker identifier and geographic region where the network request originated.
4. When only a single local region is deployed (such as local development or single-datacenter staging), the UI honestly labels the region as `us-east-local` or `local` without fabricating global coverage.

## Benefits
- High concurrency HTTP requests do not block the Fastify event loop of the control plane API.
- Workers can be scaled independently or deployed in different geographic cloud regions.
