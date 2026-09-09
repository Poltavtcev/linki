# CAMPAIGN ENGINE FORENSICS

## 1. Executive Summary
This document reconstructs the Campaign Engine for Linki, explicitly documenting the migration gap between the legacy Linear model and the current intended DAG model. The runner currently operates as a hybrid engine—using DAG routing (`edges_json`) for primary progression, but retaining hardcoded linear constructs (`delay_seconds`, `waiting_for_condition`, `executeGlobalInterrupt` remnants) which causes fragility, especially around inbound reply handling.

## 2. Legacy Linear Model
- **Structure:** Campaigns were flat arrays of steps ordered by `step_order`.
- **Execution:** The runner processed `MAX(step_order)` or incremented the counter.
- **Interrupts:** Inbound replies triggered `executeGlobalInterrupt()`, which paused or completed the entire campaign globally without routing.
- **State:** Linearly progressed. Delays were likely sleep functions or linear schedule bumps.

## 3. Current DAG Model
- **Structure:** Defined by `workflow_steps` with `edges_json` defining transitions (`next`, `on_replied`, `on_accepted`, `on_fit`).
- **Execution:** `tickActions()` in `runner.ts` processes due steps and relies on `edges_json` to determine `nextStepId`.
- **Nodes/Edges:** Support branches for AI replies (`FIT`, `NOT_FIT`) and connection statuses.

## 4. Execution Flow (The Runner Map)
**Source:** `lib/linkedin/runner.ts`
1. `tickActions()` queries `run_profile_states` where `state IN ('pending', 'running')` and `next_eval_at <= now`.
2. Acquires `account_locks`.
3. Calls `executeStep()` dynamically requiring integration modules (`visit`, `connect`, `message`).
4. **Transition:** 
   - If `WAIT` -> update `next_eval_at = now + hours`.
   - If `delay_seconds` > 0 -> update `state = 'running'`, `next_eval_at = now + delay_seconds`, skip routing.
   - If `connect` SUCCESS -> hardcode `waiting_for_condition = 'accept'`.
   - Else -> `nextStepId = edges['on_success'] || edges['next']`.
5. **Persistence:** `run_profile_states` updated with `current_step_id = nextStepId` and `state = 'pending'`.

## 5. Event Flow
- **LinkedIn/Email Reply:** Processed by `captureSdrInboundMessage` in `sdr-shim.ts`.
- **Routing:** Performs a global fallback search (`LIKE '%"on_replied"%'`) across the entire workflow.
- **Gap:** It blindly transitions the target to the *first* `on_replied` step it finds, ignoring the user's current step position.
- **Connection Accepted:** Processed via `inbox-sync.ts`. If `waiting_for_condition == 'accept'`, it releases the condition.

## 6. Persistence Flow
- UI (`[id].tsx`) generates sequential UI steps.
- API (`steps.ts`) saves backwards using `saveSequenceBackward` to build `edges_json`.
- DB stores `workflow_steps` with serialized `edges_json`.
- Runner deserializes `edges_json` at runtime.
- **Source of Truth:** UI relies on `step_order` for sorting/display, but Runner completely ignores `step_order` and uses `edges_json`.

## 7. State Machine
| Current State | Trigger | Next State | DB Mutations |
|---------------|---------|------------|--------------|
| `pending` | `next_eval_at <= now` | `running` | `account_locks` inserted |
| `running` | `executeStep` SUCCESS | `pending` | `current_step_id = nextStepId`, `next_eval_at = now` |
| `running` | `executeStep` FAILED | `failed` | `state = 'failed'` |
| `running` | `delay_seconds > 0` | `running` | `next_eval_at = now + delay_seconds` |
| `running` | `connect` SUCCESS | `running` | `waiting_for_condition = 'accept'` |
| `running` | No `nextStepId` | `completed` | `state = 'completed'` |
| `pending` | Inbound Reply | `pending` / `completed` | `current_step_id = onRepliedStepId` |

## 8. Linear/DAG Remnants (Mixed Reality)
| Logic | Legacy Linear | Current DAG | Mixed Evidence |
|-------|---------------|-------------|----------------|
| `step_order` | Core routing | Unused in Runner | UI/API still writes/reads `step_order` |
| Delays | Linear wait | Delay Nodes | Runner uses hardcoded `delay_seconds` bypass (Linear) |
| Connection wait | Global status | Event edges | Runner hardcodes `waiting_for_condition = 'accept'` |
| Inbound replies | `executeGlobalInterrupt` | `on_replied` branch | `sdr-shim.ts` hacks a `LIKE` search to guess the DAG edge |

## 9. Migration Gaps
1. **Reply Routing (CRITICAL):**
   - *Current:* `sdr-shim.ts` uses regex to find ANY `on_replied` branch.
   - *Impact:* Wrong person/message context if multiple outbound steps have different reply branches.
2. **Hardcoded Waits (HIGH):**
   - *Current:* `runner.ts` intercepts `delay_seconds` before DAG routing.
   - *Impact:* Bypasses DAG graph logic, making delays invisible to visual workflow editors.
3. **Ghost Errors (LOW):**
   - *Current:* `runner.ts:1087` has an unmatched `}` causing `TS1472`.

## 10. Behavioral Contract
1. **Routing:** `nextStepId` MUST be determined strictly by the active node's `edges_json`.
2. **Scheduling:** Steps execute strictly when `next_eval_at <= now`.
3. **Uniqueness:** A `run_profile` has exactly one active state.
4. **Interruption:** Inbound replies MUST route via the active node's `on_replied` edge (or complete if none).

## 11. Findings & Risks
- **Risk 1:** `sdr-shim.ts` reply routing is completely broken for multi-message workflows.
- **Risk 2:** Legacy syntax error in `runner.ts:1087` prevents clean TS builds.

## 12. Recommended Recovery Order (Checkpoint D)
1. Fix TS1472 in `runner.ts` (Remove extra `}`).
2. Rewrite `captureSdrInboundMessage` to lookup the active step's `edges_json` instead of searching the whole workflow.
3. Remove `step_order` reliance in API/UI if possible, or synchronize it with DAG depth.

## 13. Inbound Reply Semantics & Missing Data Linkage
To properly route an inbound reply to the correct DAG edge, the system must answer: *"Which specific outbound message is this a reply to, and which workflow step generated it?"*

### Current Data Model Capability: **NO**
The existing database schema has tables designed for this (e.g., `outbound_events`, `run_profiles.last_email_body`, `run_profile_tracks`), BUT the current `runner.ts` engine completely discards this data:
1. `executeStep()` successfully returns context with the sent message: `return { status: "SUCCESS", context: { linkedinMessage: messageText } };`
2. However, the `tickActions()` loop entirely ignores `result.context`. It does not write to `outbound_events` or `run_profile_tracks`.
3. Consequently, there is **zero historical record** of outbound messages linked to their specific DAG steps at runtime.

### Channel Distinction
- **Email:** `lib/email/inbox.ts` tries to find pending targets by checking `run_profile_tracks.last_email_body`. Because `runner.ts` never populates this field, email inbox syncing is effectively blind/broken for DAG campaigns.
- **LinkedIn:** Replies are processed by `sdr-shim.ts` via webhooks. Because there is no `outbound_events` record to join against, it cannot find the specific `step_id`. It falls back to a global `LIKE '%"on_replied"%'` across all steps in the workflow.

### Required Recovery (The Gap)
To achieve the correct behavioral contract, we MUST patch `tickActions` in `runner.ts` to persist `result.context` (the outbound message + channel) into the `outbound_events` table with the active `step_id`. Only then can `sdr-shim.ts` and `inbox.ts` match inbound replies to the exact `step_id` that originated the conversation thread.

## 14. Outbound/Inbound Correlation Contract (C.5 Forensics)

### Schema: `outbound_events`
The table `outbound_events` exists in the database schema and is perfectly designed for this correlation:
```sql
CREATE TABLE outbound_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  run_profile_id TEXT NOT NULL REFERENCES run_profiles(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('linkedin', 'email', 'inmail')),
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  message_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('sent', 'failed')),
  body TEXT
);
CREATE INDEX idx_outbound_events_target_channel ON outbound_events(target_id, channel, sent_at DESC);
```
**Conclusion:** `outbound_events` is NOT a legacy remnant. It was explicitly designed for DAG correlation (`step_id`) but its insertion logic was never merged into `runner.ts`.

### ExecuteStep Outbound Contract
When `executeStep` succeeds, it returns a `context` object containing the side effects:
- **LinkedIn (`step_type === 'message'`):** `return { status: "SUCCESS", context: { linkedinMessage: messageText } };` *(No `message_id` returned because Playwright UI automation does not easily capture the backend URN on send).*
- **InMail (`step_type === 'sales_inmail'`):** Not implemented. `executeStep` throws or skips it.
- **Email (`step_type === 'email'`):** `return { status: "SUCCESS", context: { emailSubject, emailBody: emailText, emailMessageId: msgId } };` *(Returns a concrete `msgId`).*

### Inbound Identity Correlation
| Channel | Inbound Identity | Outbound Identity | run_profile resolution | Step resolution | Reliable? |
|---------|------------------|-------------------|------------------------|-----------------|-----------|
| **LinkedIn** | `targetId` + `accountId` | `run_profile_id` + `channel='linkedin'` (Latest `sent_at`) | Looks up active run by target/account | Joins latest `outbound_events` for this channel | YES (Heuristic: flat thread) |
| **InMail** | N/A (Not Implemented) | N/A | N/A | N/A | NO |
| **Email** | `In-Reply-To` / `References` | `message_id` (1:1 match) | Exact match via `outbound_events.message_id` | Exact match via `outbound_events.step_id` | YES (Deterministic) |

### Existing Data Path & The Exact Gap
1. **At Outbound (runner.ts):** `tickActions` has access to `state.run_profile_id`, `step.id`, channel (inferred from `step_type`), and `result.context`. **GAP:** It discards `result.context` and does not insert into `outbound_events`.
2. **At Inbound (sdr-shim.ts / inbox.ts):**
   - *LinkedIn:* Uses `targetId` to find the active `run_profile`. **GAP:** Without `outbound_events`, it searches the entire workflow for ANY `on_replied` edge using `LIKE`.
   - *Email:* Parses IMAP headers (`In-Reply-To`). **GAP:** Checks `run_profile_tracks.last_email_message_id`, which is NULL, so replies are ignored.

### Edge Case Verification
- **Step 1 (LI) -> WAIT -> Step 3 (Email):** If a LinkedIn reply arrives during WAIT, we query `outbound_events` for the latest `'linkedin'` message. We get Step 1. We route to Step 1's `on_replied`. **Correct.**
- **Step 1 (LI) -> WAIT -> Step 3 (LI):** If a reply arrives after Step 3, we query for the latest `'linkedin'` message. We get Step 3. We route to Step 3's `on_replied`. **Correct.**

### Minimal Required Recovery Contract (Checkpoint D)
No schema changes are required. The existing data structures are sufficient.

**Modules that MUST change:**
1. `lib/linkedin/runner.ts`: `tickActions` must `INSERT INTO outbound_events` using data from `result.context` when `returnState === 'SUCCESS'`.
2. `lib/linkedin/sdr-shim.ts`: Must `SELECT step_id FROM outbound_events WHERE run_profile_id = ? AND channel = ? ORDER BY sent_at DESC LIMIT 1`. Then parse that step's `edges_json` to find `on_replied`.
3. `lib/email/inbox.ts`: Must query `outbound_events.message_id` instead of `run_profile_tracks` to map `In-Reply-To` to `run_profile_id` and `step_id`.

**Invariants to protect:**
- Email relies on strict 1:1 `Message-ID` correlation.
- LinkedIn relies on "latest channel outbound" correlation.
