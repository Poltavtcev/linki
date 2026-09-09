# T-002-R4-Remediation

## Context & Constraints
This document outlines the **R4 Implementation**. 
Execution is permitted under the following rules:
- No Opus.
- No destructive DB migrations for `edges_json`.
- No unrelated cleanup/refactor.
- Each R4 phase (A/B/C/D) is a scoped change.
- Run `validate.sh` after implementation.
- **MANDATORY**: Human QA reset (P0.1, P0.2, P0.3) after implementation. If P0 fails, NO-GO for next phase regardless of green automated tests.
- Acknowledge that `A (Code Similar) + B (Green Tests) != C (Behaviorally Preserved)`.

---

## R4-A: LinkedIn Session Lifecycle
**Objective:** Resolve Context Poisoning Race Condition.

**Concurrency Invariant:**
> Після успішного Manual Login жоден worker не повинен продовжувати використовувати старий Playwright context із застарілим `storageState`.

**Lifecycle & Race Check:**
1. Determine exactly: `authenticateAccount` → DB `cookies_json` write → context invalidation → next worker context acquisition.
2. `await closeSession(accountId)` post-DB write is a candidate fix, but must be verified against race windows (what if a worker is actively using the context while it's closed?).
3. Verify `startHeadlessLogin` and all other login paths adhere strictly to this invariant.

---

## R4-B: DAG Serialization
**Objective:** Restore UI compatibility for linear sequences without destroying historical branches or modifying the DB.

**Explicit Serialization Contract:**
- `main sequence` → uses `next`
- `conditional branch` → uses `on_replied`, `on_accepted`, `on_success`, etc.
- `legacy fallback` → only permitted where contract explicitly demands it.

**Deterministic Resolution Rule:**
- The parser must not "guess" semantics.
- If `next === on_replied`, then `on_replied` is unequivocally a duplicated fallback edge. The UI can project this target through `next`.
- If `next !== on_replied` (or `next` is missing/different), `on_replied` must be treated as a real conditional branch and projected accordingly.
- Do NOT run a destructive DB migration. 

---

## R4-C: Schema & Initialization Blockers
**Objective:** Resolve `reply_contexts.auto_send` 500 errors and the swallowed `sync_run_profile_tracks_state` DB trigger failures.

**Diagnosis First Protocol:**
- **Auto_send Failure:** Establish `schema definition → migration history → actual DB schema → failing INSERT/API`. Only then choose the correction path (e.g. `ALTER TABLE`).
- **Trigger Failure:** Establish:
  1. Why `CREATE TRIGGER` fails.
  2. Why the exception is swallowed.
  3. When the trigger is supposed to be created.
  4. If another projection mechanism exists.
  5. If all runtime DBs receive this trigger.
  *Note: Missing trigger in runtime is a runtime integrity failure.*

---

## R4-D: Projection Contract
**Objective:** Define the canonical Source of Truth vs. the Projection layer for the Campaign state machine.

**Plan:**
- **Canonical State:** `run_profile_states.current_step_id`
- **Projection State:** `run_profile_tracks.current_step`
- Establish the contract determining which layer is canonical and which is projection. Fix any discrepancies that cause the Pipeline step UI to render empty.

---

## INTENTIONAL ARCHITECTURAL CHANGE — BEHAVIORAL PRESERVATION NOT YET VERIFIED
The migration of the State Machine (from `runner.ts` polling to DB triggers and `sdr-shim.ts` routing) is an intentional architectural shift, but its behavioral preservation is strictly **NOT YET VERIFIED**. 

## HUMAN QA RESET
We will strictly block on Human QA for:
1. **P0.1**: `Connect → Wait 1 Day → Message 1 → Wait 1 Day → Message 2`
2. **P0.2**: `Email → Message → Wait → InMail`
3. **P0.3**: `Message → IF REPLIED → Email`

**Specific Verification Gates:**
- Manual Login → Campaign Execution
- Session refresh stability
- UI sequence after save/reload
- Canonical state & Pipeline step projection
- Reply routing
