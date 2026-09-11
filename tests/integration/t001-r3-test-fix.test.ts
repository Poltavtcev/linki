import { expect, test, beforeAll } from 'vitest';
import { getDb } from '@/lib/db';
import { tickActions } from '@/lib/linkedin/runner';
import { randomUUID } from 'crypto';
import retryHandler from '@/pages/api/runs/[id]/retry';

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

test('T-001 Finding 3: R3 retry API must successfully resume a dummy step to completion without false failure', async () => {
  const accountId = randomUUID();
  const targetId = randomUUID();
  const workflowId = randomUUID();
  const runId = randomUUID();
  const runProfileId = randomUUID();
  const stepId = randomUUID();
  const emailAccountId = randomUUID();

  // 1. Setup Data
  db.prepare("INSERT INTO accounts (id, name, email, active_hours_start, active_hours_end, working_days, timezone) VALUES (?, 'test', ?, 0, 24, '0,1,2,3,4,5,6', 'UTC')").run(accountId, randomUUID());
  db.prepare("INSERT INTO targets (id, full_name, linkedin_url) VALUES (?, 'Test Target', ?)").run(targetId, randomUUID());
  db.prepare("INSERT INTO email_accounts (id, name, from_email, smtp_host, username, password) VALUES (?, 'test', 'test@test.com', 'smtp', 'user', 'pass')").run(emailAccountId);
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'test')").run(workflowId);
  // USE 'delay' so we don't throw NotConnectedError inside executeStep
  db.prepare("INSERT INTO workflow_steps (id, workflow_id, step_order, track, step_type, message_body, edges_json) VALUES (?, ?, 1, 'main', 'delay', 'Hello', '{}')").run(stepId, workflowId);
  db.prepare("INSERT INTO runs (id, workflow_id, account_id, status) VALUES (?, ?, ?, 'running')").run(runId, workflowId, accountId);
  db.prepare("INSERT INTO run_profiles (id, target_id, run_id, email_account_id) VALUES (?, ?, ?, ?)").run(runProfileId, targetId, runId, emailAccountId);

  // 2. Set profile to failed
  db.prepare("INSERT INTO run_profile_states (run_profile_id, current_step_id, state) VALUES (?, ?, 'failed')").run(runProfileId, stepId);

  // 4. Call the Retry API
  const req = { method: 'POST', query: { id: runId }, body: { target_ids: [targetId] } } as any;
  const res = mockRes();
  await retryHandler(req, res);
  
  // 5. Assert Canonical State Machine is pending now!
  let state = db.prepare("SELECT state, next_eval_at, waiting_for_condition FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as any;
  expect(state.state).toBe('pending');

  // 6. Tick Actions - Should NOW pick it up, execute dummy (returns SUCCESS), and since it has no edges, COMPLETE it.
  await tickActions(db);

  state = db.prepare("SELECT state FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as any;
  // If it's truly resuming and executing, it will hit SUCCESS and transition to completed.
  // It shouldn't be 'failed' unless it crashed again!
  expect(state.state).toBe('completed');
});
