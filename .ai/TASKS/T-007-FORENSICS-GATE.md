# T-007-FORENSICS-GATE

## Objective
Disable `captureForensicFixture()` in production by default to prevent unnecessary overhead and disk usage, while keeping it opt-in via an environment variable (`FORENSICS_ENABLED=true`) for active incident investigations.

## Changes Made
- **`lib/linkedin/forensics.ts`**: Inserted a centralized early-return gate at the beginning of `captureForensicFixture()` that exits if `NODE_ENV === "production"` and `FORENSICS_ENABLED !== "true"`.
- **`tests/regression/forensics-gate.test.ts`**: Added regression test validating that capturing is permitted in development, denied in production by default, and permitted in production when explicitly enabled.

## Constraints Respected
- Did not modify existing call sites (`runner.ts`, `enrich.ts`, `session.ts`, `inbox-sync.ts`).
- Preserved existing Campaign Engine semantics, tracking, and circuit breaker behaviors.
- Existing instrumentation is untouched, only gated.

## Validation
- `vitest run tests/regression/forensics-gate.test.ts` passed (3/3 cases).
- `typecheck` passed for the changed files.
- `git diff --check` clean.
