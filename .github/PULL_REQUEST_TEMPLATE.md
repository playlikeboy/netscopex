## Summary of Changes

Describe the purpose, architecture decisions, and scope of this pull request.

- **Component(s) Affected**: [e.g. `apps/api`, `apps/worker`, `apps/web`, `apps/mobile`, `packages/contracts`, `packages/database`]
- **Type of Change**:
  - [ ] Bug fix (non-breaking change fixing an issue)
  - [ ] New feature (non-breaking change adding functionality)
  - [ ] Reliability / SRE enhancement
  - [ ] Performance improvement / Benchmark
  - [ ] Architectural Decision Record (ADR) / Documentation

## Architectural Considerations

- [ ] Security & SSRF validated (no unvalidated external DNS/IP calls)
- [ ] Concurrency & Lease management safe (idempotent writes, row-level locks)
- [ ] Database migrations backward compatible and indexed for query patterns
- [ ] Observability instrumented (OpenTelemetry trace propagation, Prometheus metrics)

## Verification & Testing

- [ ] `pnpm -r typecheck` passes with zero errors
- [ ] `npx vitest run` passes all unit, integration, and E2E tests
- [ ] `pnpm build` succeeds across packages
