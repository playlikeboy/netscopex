# ADR 006: SLO Calculation Semantics, Error Budgets, and Burn Rates

## Status
Accepted

## Context
Service Level Objectives (SLOs) must reflect real user impact rather than simplistic uptime percentages. We established mathematical definitions for Service Level Indicators (SLIs), Error Budgets, Multi-window Burn Rates, and insufficient data conditions.

## Mathematical Model
1. **Eligible Events ($E_{total}$):** Total probe checks executed within rolling lookback window ($T$).
2. **Good Events ($E_{good}$):**
   - For Availability SLO: checks where $status\_code \in expectedStatusCodes$.
   - For Latency SLO: checks where $success == true \land totalDurationMs \le latencyThresholdMs$.
3. **Service Level Indicator (SLI):**
   $$SLI = \frac{E_{good}}{E_{total}} \times 100$$
4. **Permitted Error Rate ($R_{perm}$):**
   $$R_{perm} = 1 - \frac{Target}{100}$$
5. **Observed Error Rate ($R_{obs}$):**
   $$R_{obs} = \frac{E_{total} - E_{good}}{E_{total}}$$
6. **Error Budget Consumed ($B_{consumed}$):**
   $$B_{consumed} = \frac{R_{obs}}{R_{perm}} \times 100$$
7. **Burn Rate ($BR$):**
   $$BR = \frac{R_{obs}}{R_{perm}}$$
8. **Burn Rate Alerts:**
   - **Fast Burn Alert:** $BR \ge 14.4$ (consumes 2% of budget in 1 hour; immediate paging).
   - **Slow Burn Alert:** $BR \ge 6.0$ (consumes 5% of budget in 6 hours).

## Treatment of Missing / Low Data
If $E_{total} < minSamplesRequired$ (default 5 checks), NetScope X outputs `status: INSUFFICIENT_DATA`. Under no circumstances is 100% reliability reported when no checks have been collected.
