# T-004: Enrich Profile & Message Accounting Investigation

## 1. linkedin_enrich Status
**IMPLEMENTED / HUMAN QA PASS / historical timeout unexplained**
The execution path for \`linkedin_enrich\` was restored. During one Human QA run, it timed out for an unexplained reason. A subsequent Human QA run passed successfully. Forensic instrumentation (\`captureForensicFixture\`) was added to safely capture DOM/screenshots for any future timeouts or missing intercept data without breaking normal execution.

## 2. Message Accounting
**FIXED**
A defect was identified where a successfully sent LinkedIn Message did not increment the Funnel Analytics (\`LI Messages\`) or appear in Campaign History. The root cause was a missing \`log(..., "Message sent to...")\` call in the new DAG runner. The log was restored, perfectly mirroring historical compatibility.

## 3. outbound_events Persistence
**CONFIRMED**
During the specific QA run for "Maria Solodar", the outbound network side effect (LinkedIn message) was sent successfully, and the system correctly persisted an \`outbound_events\` record with \`status=sent\`. This proves the external side effect is durably recorded.

## 4. Idempotency Limitation (T-001)
**UNCHANGED / NOT CLOSED**
While the Maria QA run successfully persisted its \`outbound_events\` record, this does not override the established T-001 limitation. The crash-window between external side effect execution and durable persistence still exists in the architecture. T-001 and F-03 remain open.

## 5. Regression Tests
A regression test (\`tests/regression/message-accounting.test.ts\`) was added. It is **projection-level only**, utilizing an in-memory SQLite database to simulate the exact logging scenario and funnel query counting. It does not perform an end-to-end LinkedIn send test (avoiding synthetic false-confidence).
