# Campaign Engine Characterization

This document records the forensic analysis and actual behavior of the Linki Campaign Engine at Checkpoint C. It strictly separates verified facts, actual observed behavior, contract expectations, unknowns, and confirmed bugs.

## 1. Test Archaeology
*Historical testing/bugs and their current status during characterization:*
- **DB Isolation Leak (P0)**: *Fixed in Test Infra Checkpoint*. Tests previously wrote to the physical `linki.db`. All tests now run isolated against `:memory:` via `tests/setup.ts`.
- **Delay Duplicate Execution (P0)**: *Confirmed Bug*. `tickActions` executes message side-effects before evaluating the `delay_seconds` interceptor, resulting in duplicate side-effects.
- **Multiple Active Runs Invariant (P1 Candidate)**: *Verified Fact*. Enrollment has an application-level invariant against multiple active runs per target, but the DB lacks a strict unique constraint. If multiple active runs exist, inbound correlation (sdr-shim) safely pauses the profile, but runtime collision handling elsewhere remains an untested invariant.
- **Connect Edge Omission (P1 Candidate)**: *Unknown*. Missing `on_accepted` edges silently complete the campaign. It is unestablished whether the UI contract allows `next` edges here.

## 2. Canonical DAG Model
**VERIFIED FACT**: Workflows are stored as a flat list of `workflow_steps`. Routing is defined entirely within the `edges_json` payload (`next`, `on_success`, `on_replied`, `on_accepted`, `on_fit`). 
**OBSERVED ACTUAL**: There are no standalone "Delay" or "Condition" node records; they are procedural attributes (`delay_seconds`) or baked into specific step types (`ai_qualify`).

## 3. Runtime State Machine
**VERIFIED FACT**: Controlled by `tickActions` in `lib/linkedin/runner.ts`.
- **Actionable Query**: Requires `runs.status = 'running'`, `run_profile_states.state IN ('pending', 'running')`, `next_eval_at <= now`, and `waiting_for_condition IS NULL`.
- **Terminal States**: If a step is missing or `current_step_id` is explicitly null, `state` transitions to `completed`.
- **Paused**: Used as an interception layer for manual review or uncorrelated replies.

## 4. Outbound Correlation
**VERIFIED FACT**: If `executeStep` returns `SUCCESS` for `message` or `email` step types, an `outbound_event` is explicitly INSERTed with `status = 'sent'`. Failed communications (e.g., rate limit, network error) return `FAILED` or `WAIT` and do not write an `outbound_event`.
**OBSERVED ACTUAL**: LinkedIn messages store the body but no deterministic remote ID. Email messages store `message_id` (from the transporter).

## 5. Inbound Correlation (LinkedIn & Email)
**VERIFIED FACT**: Fully integrated via `outbound_events`.
- **Routing**: Inbound reply -> identify `run_profile` -> identify channel -> find latest successful `outbound_event` for that `run_profile` + channel -> obtain originating `step_id` -> read that step's `edges_json` -> resolve `on_replied`.
- **Fallback**: Known `run_profile` + missing `on_replied` edge -> safely transitions to `paused` (`uncorrelated_reply`).
- **Ambiguity**: Uncorrelated inbound or targets with multiple active `run_profiles` -> NO arbitrary state mutation, run profile is paused for human review.

## 6. Connect/Acceptance
**VERIFIED FACT**: `step_type === 'connect'` executes via Playwright. If successful, `tickActions` sets `waiting_for_condition = 'accept'` and `state = 'running'`. `current_step_id` remains the `connect` step.
- Later, `lib/linkedin/sync-accepted.ts` polls for acceptances. When a connection is accepted, it executes an `UPDATE` reading `$.on_accepted` from the `edges_json` of the *current* `connect` step.
**UNKNOWN**: If a user configures a DAG where the `connect` step uses `next` instead of `on_accepted` to route, `$.on_accepted` will evaluate to `NULL`, completing the run. It is unknown if the UI strictly enforces `on_accepted` or if `next` was intended to be allowed.

## 7. Delay / WAIT Model
**VERIFIED FACT**: `delay_seconds` is evaluated *procedurally* in `tickActions` **AFTER** `executeStep` returns.
**OBSERVED ACTUAL**: 
- Tick 1: Runner evaluates a `pending` step. `executeStep` runs, sends the message, and returns `SUCCESS`. The delay block matches (`delay_seconds > 0 && state === 'pending'`). Runner updates state to `running`, sets `next_eval_at`, and skips edge routing.
- Tick 2: Runner evaluates the now `running` step. `executeStep` runs AGAIN, sending the message AGAIN. The delay block fails (`state` is not `pending`). Runner proceeds to edge routing.
**BUG**: This results in duplicate message sending for any step with a delay.

## 8. Characterization Matrix

| SETUP | ACTION | DB BEFORE | DB AFTER | CONTRACT | ACTUAL | CLASSIFICATION |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Message Step | executeStep() SUCCESS | `pending` | `next` | `outbound_event` created | `outbound_event` created | VERIFIED FACT |
| Message Step | executeStep() FAILED | `pending` | `failed` | No `outbound_event` | No `outbound_event` | VERIFIED FACT |
| Message + `delay_seconds > 0` | tickActions() over 2 ticks | `pending` | `next` / `completed` | Sends message ONCE | Sends message TWICE | BUG |
| Connect Step (w/ `on_accepted`) | sync-accepted.ts | `waiting` = 'accept' | `pending` | Routes to `on_accepted` | Routes correctly | VERIFIED FACT |
| Connect Step (w/ `next` only) | sync-accepted.ts | `waiting` = 'accept' | `completed` | Contract unclear | Early termination | UNKNOWN |
| Exact Correlation | capture Inbound | `pending` | `pending` | Routes to `on_replied` | Routes correctly | VERIFIED FACT |
| Multiple active runs | capture Inbound | `pending` | `paused` | Pause for manual review | Pauses safely | VERIFIED FACT |

## 9. Confirmed Bugs
1. **Delay Node Duplicate Execution (P0)**: Any action step (message/email) with `delay_seconds > 0` executes its side-effect twice due to the delay interceptor executing *after* the action block and failing to advance the cursor.

## 10. Unknowns
- Are there edge cases in Playwright session handling where `tickActions` crashes midway and leaves `account_locks` permanently locked?
- Existing DB Migration safety remains UNKNOWN due to lack of representative old-schema fixtures.
- Valid edge contracts for `connect` steps (does UI enforce `on_accepted` or allow `next`?).

## 11. Recovery Candidates (Backlog)
- *Candidate*: Separate delay logic to evaluate *before* `executeStep`, or migrate `delay_seconds` into structurally independent DAG nodes (`wait` step_type).
- *Candidate*: Hardcode a fallback in `sync-accepted.ts` to check for `$.next` or `$.on_success` if `$.on_accepted` is null.
- *Candidate*: Add fencing/heartbeat cleanup for orphaned `account_locks`.
- *Candidate*: Create a formal DB constraint or strict app-level validation against multiple active runs for a single target.
