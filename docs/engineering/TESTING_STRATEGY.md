# Linki — Testing Strategy

## Current State (Baseline)

- **Formal test suite:** Vitest configured and running.
- **Test runner script:** `npm run test` uses Vitest.
- **Ad-hoc tests:** Many root-level `test_*` scripts remain but are actively being phased out or promoted.
- **Validation:** `scripts/validate.sh` is the single source of truth.

## Testing Philosophy

### 1. Characterization First

Before changing ANY existing behavior:
1. Understand what the system currently does (read code)
2. Write a characterization test that captures the current behavior
3. Verify the characterization test passes against unmodified code
4. Only then make the change
5. The characterization test should now either:
   - Still pass (if the change is additive)
   - Fail in an expected way (if the change is intentional behavioral modification — update the test)

This prevents the "fix one thing, break another" cycle.

### 2. Regression Before Feature

Every bug fix should produce a regression test before the fix is applied:
1. Write a test that reproduces the bug (test should FAIL)
2. Apply the fix
3. Verify the test now PASSES
4. The test permanently guards against this bug returning

### 3. Strict Production-Coupling

**All tests MUST call production code.**
If a test defines a fake copy of the production logic (e.g., a mock `verifierFn` or an isolated SQLite query not executed via the real app), it provides **FALSE CONFIDENCE**. Tests that cannot be production-coupled without massive refactoring should NOT be invented or bypassed—they should be marked as findings, and the application architecture should be refactored eventually to make them testable.

## Test Organization

```
tests/
├── unit/                   # Pure function tests, no external deps
│   ├── crypto.test.ts      # Encryption/decryption roundtrip
│   └── ...
├── integration/            # Tests that touch DB or APIs
│   └── ...
├── regression/             # Tests targeting specific previous bugs
│   ├── linkedin-dom-selectors.test.ts
│   └── runner-sqli.test.ts
└── characterization/       # Capture existing behavior before changes
```

## Validation Entrypoint

All validation runs through `scripts/validate.sh`. This is the single source of truth for "does the code pass?"

The script runs the following gates in order:
1. **TypeScript typecheck** (`npx tsc --noEmit`) — core source only
2. **Unit & Regression Tests** (`npm run test`)
3. **Build** (`npx next build`) — to ensure the frontend compiles

Each gate reports PASS/FAIL independently. The script exits non-zero if any gate fails.

## What Counts as a Test

| ✅ Counts | ❌ Does NOT Count |
|-----------|-------------------|
| `.test.ts` file in `tests/` directory | Root-level `test_*.ts` script |
| Runs via test runner (Vitest) | Manual `npx tsx` execution |
| Has assertions that fail on wrong behavior | Script that prints output for human inspection |
| Calls REAL production functions | Tests isolated copies of logic ("Fake Confidence") |

## Current Blind Spots (HONEST ASSESSMENT)

Many critical areas of the system are currently **NOT** covered by tests:
- **Runner DAG execution (`lib/linkedin/runner.ts`)**: The state transitions, heartbeat lock logic, and step progression are largely untested because the logic is deeply intertwined with Playwright execution and direct SQLite side-effects. `tests/regression/runner-sqli.test.ts` ONLY tests a standalone SQLite string concatenation to verify SQLi safety, NOT the actual runner.
- **Workflow UI & Persistence**: Round-tripping of DAG step saving/loading via the UI is entirely uncovered. The archive scripts used mock copies of the API rather than the real code.
- **Inbound Interrupts**: `executeGlobalInterrupt` doesn't even exist in the codebase! The legacy scripts testing this functionality are decoupled from reality.
- **Session/Auth logic**: Untested.
- **DB Migrations**: Schema updates are untested.

**Do not claim coverage where there is none.**
