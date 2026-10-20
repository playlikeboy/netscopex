# ADR 005: Metric Aggregation Strategy & Statistical Calculations

## Status
Accepted

## Context
Operators require statistical latency distribution percentiles (p50, p90, p95, p99) and regression detection across rolling windows. We evaluated client-side in-memory quantile estimation (t-digest, HdrHistogram) versus PostgreSQL database-level percentiles.

## Decision
We implemented **SQL-native Continuous Percentile Aggregations** using PostgreSQL's `percentile_cont(P) WITHIN GROUP (ORDER BY (timing->>'totalDurationMs')::numeric)` combined with indexed window constraints (`executed_at >= window_start`).

## Trade-offs
- **Accuracy:** Exact linear interpolation of continuous percentiles without heuristic quantile loss or memory buffering on API servers.
- **Performance:** Benchmarked at < 15ms query duration for 1,000+ points in a rolling window due to composite B-tree indexing on `(monitor_id, executed_at DESC)`.
