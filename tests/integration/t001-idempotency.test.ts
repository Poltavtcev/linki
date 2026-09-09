import { expect, test, beforeAll, vi } from 'vitest';
import { getDb } from '@/lib/db';
import { tickActions } from '@/lib/linkedin/runner';
import { randomUUID } from 'crypto';
import retryHandler from '@/pages/api/runs/[id]/retry';
import * as messageModule from '@/lib/linkedin/message';
import * as sessionModule from '@/lib/linkedin/session';

let db: ReturnType<typeof getDb>;

beforeAll(() => {
  db = getDb();
});

const mockRes = () => {
  const res: any = {};
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (data: any) => { res.data = data; return res; };
  res.end = () => res;
  return res;
};

test('T-001 Finding 2a: True Crash Window (Architectural Limitation)', async () => {
  const accountId = randomUUID();
  const targetId = randomUUID();
  const workflowId = randomUUID();
  const runId = randomUUID();
  const runProfileId = randomUUID();
  const stepId = randomUUID();

  db.prepare("INSERT INTO accounts (id, name, email) VALUES (?, 'test', ?)").run(accountId, randomUUID());
  db.prepare("INSERT INTO targets (id, full_name, linkedin_url) VALUES (?, 'Test Target', 'https://linkedin.com/in/test-crash')").run(targetId);
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'test')").run(workflowId);
  db.prepare("INSERT INTO workflow_steps (id, workflow_id, step_order, track, step_type, message_body, edges_json) VALUES (?, ?, 1, 'main', 'message', 'Hello', '{}')").run(stepId, workflowId);
  db.prepare("INSERT INTO runs (id, workflow_id, account_id, status) VALUES (?, ?, ?, 'running')").run(runId, workflowId, accountId);
  db.prepare("INSERT INTO run_profiles (id, target_id, run_id) VALUES (?, ?, ?)").run(runProfileId, targetId, runId);

  db.prepare("INSERT INTO run_profile_states (run_profile_id, current_step_id, state) VALUES (?, ?, 'pending')").run(runProfileId, stepId);

  let callCount = 0;
  
  // 1. sendMessage SUCCEEDS!
  vi.spyOn(messageModule, 'sendMessage').mockImplementation(async () => {
    callCount++;
    return { messagingUrn: 'test_urn' } as any;
  });

  vi.spyOn(sessionModule as any, 'getSessionPage').mockImplementation(async () => {
    return { close: async () => {} } as any;
  });
  
  // 2. CRASH happens AFTER side effect but BEFORE tickActions can persist outbound_events!
  vi.spyOn(sessionModule as any, 'saveSessionState').mockImplementation(async () => {
    throw new Error('SIMULATED_CRASH_DURING_SESSION_SAVE');
  });

  // Tick Actions - Engine picks it up, calls sendMessage (success), catches crash, marks as failed.
  await tickActions(db);

  // Assert it failed
  const state = db.prepare("SELECT state FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as any;
  expect(state.state).toBe('failed');
  expect(callCount).toBe(1); // The message was "sent" externally!

  // The user sees "failed" and clicks "Retry"
  const req = { method: 'POST', query: { id: runId }, body: { target_ids: [targetId] } } as any;
  const res = mockRes();
  await retryHandler(req, res);

  // Tick Actions - Engine resumes the profile.
  await tickActions(db);

  // CRITICAL LIMITATION ASSERTION:
  // Because SQLite and external network are not atomically bound, the DB has NO RECORD of the previous send.
  // We document that this WILL duplicate, expecting callCount to be 2.
  // This explicitly validates the Two Generals limitation.
  expect(callCount).toBe(2); 
});

test('T-001 Finding 2b: Deterministic Persisted-Event Deduplication', async () => {
  const accountId = randomUUID();
  const targetId = randomUUID();
  const workflowId = randomUUID();
  const runId = randomUUID();
  const runProfileId = randomUUID();
  const stepId = randomUUID();

  db.prepare("INSERT INTO accounts (id, name, email) VALUES (?, 'test', ?)").run(accountId, randomUUID());
  db.prepare("INSERT INTO targets (id, full_name, linkedin_url) VALUES (?, 'Test Target', 'https://linkedin.com/in/test-dedupe')").run(targetId);
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'test')").run(workflowId);
  db.prepare("INSERT INTO workflow_steps (id, workflow_id, step_order, track, step_type, message_body, edges_json) VALUES (?, ?, 1, 'main', 'message', 'Hello', '{}')").run(stepId, workflowId);
  db.prepare("INSERT INTO runs (id, workflow_id, account_id, status) VALUES (?, ?, ?, 'running')").run(runId, workflowId, accountId);
  db.prepare("INSERT INTO run_profiles (id, target_id, run_id) VALUES (?, ?, ?)").run(runProfileId, targetId, runId);

  // 1. Profile is pending
  db.prepare("INSERT INTO run_profile_states (run_profile_id, current_step_id, state) VALUES (?, ?, 'pending')").run(runProfileId, stepId);

  // 2. We mock that outbound_events ALREADY HAS a sent record for this exact step (e.g. from manual restart after success)
  db.prepare(`
    INSERT INTO outbound_events (id, run_id, run_profile_id, target_id, step_id, channel, sent_at, status, body)
    VALUES (?, ?, ?, ?, ?, 'linkedin', datetime('now'), 'sent', 'Hello')
  `).run(randomUUID(), runId, runProfileId, targetId, stepId);

  let callCount = 0;
  vi.spyOn(messageModule, 'sendMessage').mockImplementation(async () => {
    callCount++;
    return { messagingUrn: 'test_urn' } as any;
  });

  vi.spyOn(sessionModule as any, 'getSessionPage').mockImplementation(async () => {
    return { close: async () => {} } as any;
  });
  vi.spyOn(sessionModule as any, 'saveSessionState').mockImplementation(async () => {});

  // 3. Tick Actions
  await tickActions(db);

  // 4. This MUST NOT DUPLICATE. Currently this expects 0, but it will fail because callCount will be 1 (before our fix).
  // Once Titan fixes it, this test will turn Green.
  expect(callCount).toBe(0);
});
