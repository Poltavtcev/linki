# T-002: Adversarial Defects Remediation

## Goal
Remediate the confirmed CRITICAL and HIGH/MEDIUM defects identified in Red Team #2, strictly focusing on targeted fixes without structural refactoring.

## Contract
1. **F-07/F-08 (Unenroll/Bounce during in-flight tick resurrects profile):**
   - Add a canonical terminal-state race guard to blind-updates in `tickActions`.
   - Invariant: A canonical state change to a terminal state after selection must prevent the old in-flight execution from returning the profile to an actionable state.
2. **F-01 (Email Reply Double-Mutation):**
   - Remove the heuristic routing overwrite (`stopBasic` / `current_step_id` reassignment) from `processReply` if deterministic correlation already succeeded.
   - Invariant: A single inbound reply should produce exactly ONE state transition on `run_profile_states`.
3. **F-02 (processReply Case-Sensitivity):**
   - Fix case sensitivity (`'PAUSED'` -> `'paused'`) in `processReply` state queries.
   - Invariant: State comparisons must use canonical lowercase strings.
4. **F-05 (Fencing assertLock Missing):**
   - Implement `assertLock()` immediately before `sendMessage` execution in `runner.ts`.
   - Invariant: Fencing checks must happen immediately before every irreversible external side effect.
5. **F-10 (Sync Trigger Hides 'paused' State):**
   - Update UI projection logic to expose canonical paused/uncorrelated/stalled states so they do not mask as `in_progress`.
   - Invariant: Human-approval and uncorrelated-reply flows must be visible/actionable to the user.

## Constraints & Forbidden Actions
- NO structural refactoring of `tickActions`.
- NO architectural changes outside of the F-01 premium module fix.
- NO database schema changes.
- NO changes to Playwright/session architecture.
- NO unrelated cleanup.
- MUST NOT fix F-03 (Accepted Limitation).

## Process
1. **HostileTester:** Write characterization tests for each defect that FAIL on the current production codebase for the correct reason. For F-07/F-08, prove the race condition at the UPDATE level. For F-01, build a deterministic DAG where exact outbound correlation yields Step A, but the heuristic yields Step B (A != B).
2. **Titan:** Implement minimal targeted fixes until tests pass.
