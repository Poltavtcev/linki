# Linki — Project Contract

## What This Document Is

This is the operational contract for all AI-driven development on the Linki project.
It translates the Recovery Plan diagnosis into enforceable rules.
Every agent (Supervisor and Titan) must comply.

---

## System Invariants

These are properties that must remain true regardless of any implementation change.
Violating an invariant is a task failure.

### Data Integrity

1. **SQLite is the single source of truth.** All durable state lives in `linki.db`.
2. **No migration may silently fail.** If a schema change errors, it must be surfaced, not swallowed.
3. **No data deletion without explicit user action.** Automated processes must not delete contacts, campaigns, or conversation history.
4. **Encrypted secrets stay encrypted.** AES-256-GCM encrypted values in the DB must never be written back in plaintext.

### Security

5. **Server secrets must not reach the browser.** `INTERNAL_API_SECRET`, `NEXTAUTH_SECRET`, database credentials, API keys — none may appear in client-side HTML, JS bundles, or `__NEXT_DATA__`.
6. **Authentication gates must not be bypassed.** Every API route that accesses user data must verify session or internal secret.
7. **Debug/diagnostic routes must not exist in production.** Any route exposing stack traces, hardcoded UUIDs, or raw DB dumps must be gated or removed.

### Execution Safety

8. **The runner must be idempotent per profile per step.** Re-running a tick must not duplicate LinkedIn actions (double connect, double message).
9. **Circuit breaker must not be circumventable.** If LinkedIn rate limiting is detected, all automation for that account must stop.
10. **Campaign state transitions must be atomic.** A profile cannot be in two states simultaneously.

### Architecture

11. **No circular dependencies between modules.**
12. **No runtime-critical code in ad-hoc root scripts.** Application logic lives in `lib/`, `pages/`, `components/`, `ee/`.
13. **TypeScript is the source of truth.** Where `.ts` and `.js` duplicates exist, `.ts` is canonical. `.js` duplicates must be eliminated, not maintained.

---

## Protected Paths

These files/directories require Supervisor approval before modification:

| Path | Risk | Reason |
|------|------|--------|
| `lib/linkedin/runner.ts` | HIGH | Core execution engine, 1872 LOC, most critical module |
| `lib/linkedin/session.ts` / `.js` | HIGH | Browser context lifecycle, auth cookies |
| `lib/db.ts` / `.js` | HIGH | Database schema, migrations, all queries |
| `lib/auth.ts` | HIGH | Authentication and authorization |
| `lib/crypto.ts` / `.js` | HIGH | Secret encryption/decryption |
| `pages/api/auth/*` | HIGH | Auth endpoints |
| `pages/workflows/[id].tsx` | HIGH | 4267 LOC god component, extremely fragile |
| `ee/index.ts` | MEDIUM | AI SDR engine, premium feature |
| Database schema (any `CREATE TABLE`, `ALTER TABLE`) | HIGH | Data integrity |

---

## Risk Classification

### LOW
- Cleanup (archiving files, removing dead code)
- Documentation changes
- Isolated test additions
- Type-only changes (adding types without changing runtime behavior)
- Style/formatting fixes

### MEDIUM
- Shared utility modifications
- API route changes (non-auth)
- Dependency updates
- New component additions
- Configuration changes

### HIGH
- `lib/linkedin/runner.ts` — any modification
- LinkedIn automation modules — behavioral changes
- Authentication/security code
- Database migrations or schema changes
- Workflow execution state machine
- `pages/workflows/[id].tsx` — any modification

### EXTREME
- Simultaneous changes to multiple HIGH-risk domains
- Changes that cross the runner ↔ DB ↔ session boundary
- Migration + runner change in same task
- Security model changes

---

## Validation Requirements by Risk Level

| Risk | Typecheck | Unit Test | Integration Test | Build | Diff Review | Adversarial Review | Supervisor Approval |
|------|-----------|-----------|-----------------|-------|-------------|-------------------|-------------------|
| LOW | ✅ | ✅ (if applicable) | — | ✅ | ✅ | — | — |
| MEDIUM | ✅ | ✅ | ✅ (if applicable) | ✅ | ✅ | — | — |
| HIGH | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Required |
| EXTREME | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Required + Pre-approval |

---

## Change Scope Rules

1. **One task = one logical change.** No mixing unrelated fixes.
2. **Scope is defined before implementation.** If scope needs expansion, STOP and request approval.
3. **Reversibility preferred.** Changes should be easy to revert. Prefer additive over destructive.
4. **Characterization before modification.** Before changing existing behavior, write a test that captures what the system currently does. Then modify.
5. **Evidence over assertion.** "It works" is not evidence. `validate.sh` output is evidence. Git diff is evidence. Test output is evidence.
