# DEFERRED-INMAIL-001: Sales Navigator InMail Recovery & Inbox Integration

**Status:** DEFERRED (Discovered during P0.1 Human QA Forensic Investigation)  
**Priority:** P2 / Post-Human-QA Architectural Recovery  
**Origin Date:** 2026-09-09  

---

## 1. Context & Discovery
During the implementation and validation of the Forensic Fixture Gate for P0.1 Human QA, audit of `lib/linkedin/runner.ts` revealed:
- `step_type: "sales_inmail"` is declared in TypeScript step contracts (`runner.ts:169`) and supported in historical DB schema migrations (`lib/db.ts:913`).
- **No execution branch exists** in `executeStep` inside `lib/linkedin/runner.ts` for `sales_inmail`.
- InMail is currently non-functional in the Campaign Engine and cannot be executed by the runner.
- Per strict governance instructions, this gap is explicitly NOT being addressed in R4 / current Human QA remediation. It is formally recorded here so it cannot be silently omitted or forgotten during future Campaign Engine work.

---

## 2. Core Architectural Constraint
InMail MUST NOT be implemented as an isolated "send message" action. It must strictly adhere to the unified Campaign Engine lifecycle:
```text
execution → outbound evidence → inbox correlation → state transition → branch routing
```

---

## 3. Required Scope of Work

1. **Execution Path:**
   - Implement genuine `sales_inmail` step execution inside `executeStep()`.
   - Maintain appropriate limit tracking and error mapping (`No InMail credits left`, etc.).

2. **Sales Navigator Session & Page Semantics:**
   - Dedicated Sales Navigator page context acquisition.
   - Verification of `li_ep_auth_context` seat cookie presence prior to navigation.
   - Handling Sales Navigator UI DOM selectors for InMail compose modal.

3. **Outbound Evidence & Audit Trail:**
   - Insert synchronous record into `outbound_events` on success (`channel = 'linkedin'`, step correlation, message body, recipient URN/ID).

4. **Idempotency Contract:**
   - Adhere to the T-001 idempotency invariant: pre-flight check on `outbound_events` prior to network action to prevent duplicate sends across runner retries or restarts.

5. **Failure & Circuit Breaker Behavior:**
   - Handle limit exhaustion gracefully (`LIMIT_REACHED` / reschedule).
   - Report failures via circuit breaker and capture forensic fixture upon unexpected Playwright errors.

6. **Inbound Reply Correlation via Inbox:**
   - Handle replies to Sales Navigator InMail threads.
   - Ensure Sales Navigator / Flagship message thread synchronization captures InMail replies without losing identity.

7. **Deterministic Branch Routing:**
   - Route reply events via `InMail → reply → originating step → on_replied` without falling back to heuristic global searches.

8. **AI Auto-Reply / Inbound Response Integration:**
   - Якщо увімкнено AI автовідповідь (AI Auto-Reply / Draft / Auto-Send), вона повинна реагувати на відповіді, отримані через InMail треди, так само повноцінно, як і на стандартні повідомлення.
   - Підтримка контексту InMail діалогу (попередні повідомлення з InMail треду) при генерації промпта для AI.
   - Відправка автовідповіді (чи генерація чернетки) через відповідний канал (Sales Navigator / LinkedIn inbox) з дотриманням `auto_send` інваріантів.

9. **Canonical State Integration:**
   - Interact solely with canonical `run_profile_states`. Projections to `run_profile_tracks` must be derived automatically via triggers or views.

10. **UI & Projection Consistency:**
   - Ensure `sales_inmail` displays correctly in the campaign builder, timeline, contacts list, and execution logs.

---

## 4. Mandatory Human QA & Verification Matrix

- [ ] **Scenario 1:** Successful InMail dispatch to an eligible prospect (valid outbound event recorded).
- [ ] **Scenario 2:** Failed InMail (e.g. no credits left, profile blocks InMail) resulting in proper state transition without crash.
- [ ] **Scenario 3:** Prospect replies to InMail -> deterministic routing through originating step's `on_replied` edge.
- [ ] **Scenario 4:** Inbound reply to InMail triggers AI Auto-Reply (draft created or auto-sent depending on settings).
- [ ] **Scenario 5:** Inbound message arrives that is NOT an InMail reply (must not trigger false branch advancement).
- [ ] **Scenario 6:** Runner crash/restart simulation mid-tick -> T-001 idempotency deduplication prevents second send.
- [ ] **Scenario 7:** Retry action triggered on failed InMail -> clean resume and progression.
