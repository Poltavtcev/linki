# DEFERRED-INMAIL-001 — Sales Navigator InMail Recovery & Inbox Integration

## 1. Executive Summary
This document consolidates the forensic archaeology and current status of the `sales_inmail` capability in the Campaign Engine.

**Current Implementation Status: DO NOT IMPLEMENT YET.**
This feature is explicitly deferred. This document serves as the architectural foundation and preservation contract for when implementation resumes.

## 2. Current Observed Facts (CONFIRMED)
- **UI & Schema:** The `sales_inmail` step type exists in the workflow builder UI and the `workflow_steps.step_type` database schema.
- **Engine Execution:** `NOT IMPLEMENTED / NO HANDLER`. The `executeStep` function currently lacks a `switch`/`case` handler for `sales_inmail`.
- **Inbox Sync:** The `inbox-sync.ts` and `sdr-shim.ts` exclusively process standard LinkedIn messaging threads (`linkedin.com/messaging/thread/...`).
- **Automation Code:** There is no execution logic (Playwright automation) in the current codebase to draft, send, or verify Sales Navigator InMails.
- **Inbound Sync:** There is no DOM parsing or routing logic for the Sales Navigator Inbox (`linkedin.com/sales/inbox/...`).

## 3. Historical Facts (CONFIRMED)
- **Standard LinkedIn messaging** was historically the primary focus and remains structurally intact.
- **Not lost in DAG Migration:** The InMail capability should **not** be considered lost as a regression during the recent DAG migration.
- **Premium/Enterprise Separation:** Inspection of `_archive`, `inhubflow-linki-main`, and git history (`d689be5`, `ae98709`) indicates that the historical `sendInMail` logic was maintained as a separate premium enterprise implementation tree (`ee/inmail.ts`) that was excluded from the open-source foundation.
- **Legacy Reply Routing:** The historical implementation relied on heuristic URN mapping (`urn:li:%`) hardcoded to standard messaging URLs. It did not natively parse the Sales Navigator Inbox DOM.

## 4. UNKNOWN
- The precise logic previously used in `ee/inmail.ts` (e.g., exact DOM selectors used for InMails) is unavailable in the current repository.
- It is unknown if historical InMail quota tracking was handled client-side or server-side.

## 5. PROPOSED FUTURE REQUIREMENTS
When this task is resumed, the implementation design SHOULD consider the following:

1. **Execution Automation:** Implement the `sendInMail` Playwright automation against the current Sales Navigator DOM.
2. **Inbox Sync:** Extend `inbox-sync.ts` (or create a parallel sync) to parse `/sales/inbox/` for replies. Without this, the engine risks sending follow-ups to prospects who have already replied via InMail.
3. **Credit Accounting (PROPOSED):** Evaluate tracking `daily_inmail_limit` to safely account for strict monthly premium quotas without breaking campaigns.
4. **URN Extraction / ThreadResolver (PROPOSED):** Investigate normalizing unique InMail URNs or building a unified ThreadResolver to correctly map both standard and Sales Nav threads to a single prospect `target_id`.
