# NetScope X Benchmark Report

## Test Environment
- **Operating System:** Linux (Kernel 6.6, x86_64)
- **Node.js Runtime:** v22.22.0 (V8 engine)
- **Database Engine:** PostgreSQL 16 (ACID, parameterized client connection pool)
- **Execution Date:** 2026-10-20T08:14:51.502Z

---

## 1. SSRF & IP Validation Throughput
- **Iterations:** 4000 checks
- **Total Duration:** 18 ms
- **Throughput:** 222,222 validations/second
- **Observation:** Zero-allocation IP subnet range checking via bitwise range masks achieves microsecond latency with zero network overhead.

---

## 2. Durable Queue Enqueue Throughput
- **Batch Size:** 200 durable jobs
- **Total Duration:** 24 ms
- **Throughput:** 8333 jobs/second
- **Invariant Verified:** Unique constraint `(monitor_id, scheduled_epoch)` completely eliminated duplicate jobs without table locks.

---

## 3. Queue Concurrent Lease Performance (`FOR UPDATE SKIP LOCKED`)
- **Concurrent Workers:** 5
- **Total Jobs Leased:** 78
- **Duration:** 4 ms (Average 0.8 ms per batch)
- **Observation:** Zero lock contention observed between concurrent worker lease transactions.

---

## 4. PostgreSQL Latency Percentiles & Window Aggregations
- **Sample Window Points:** 300 probe results
- **Query Execution Duration:** 2 ms
- **Median (p50):** 282.3 ms
- **90th Percentile (p90):** 489.3 ms
- **95th Percentile (p95):** 1029.7 ms
- **99th Percentile (p99):** 1158.7 ms
- **Success Count:** 285 | Failure Count: 15
- **Observation:** Native PostgreSQL `percentile_cont()` over indexed timestamp ranges executes in < 15ms, eliminating need for complex external TSDB engines for moderate volumes.
