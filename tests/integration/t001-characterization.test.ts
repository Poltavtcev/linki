import { expect, test, beforeAll } from 'vitest';
import { getDb } from '@/lib/db';
import { tickActions } from '@/lib/linkedin/runner';
import { randomUUID } from 'crypto';
import unenrollHandler from '@/pages/api/runs/[id]/unenroll';
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

test('T-001 Finding 1: Unenroll should halt a target even if it is in failed state', async () => {
  const accountId = randomUUID();
  const targetId = randomUUID();
  const workflowId = randomUUID();
  const runId = randomUUID();
  const runProfileId = randomUUID();
  const stepId = randomUUID();

  db.prepare("INSERT INTO accounts (id, name, email) VALUES (?, 'test', ?)").run(accountId, randomUUID());
  db.prepare("INSERT INTO targets (id, full_name, linkedin_url) VALUES (?, 'Test', ?)").run(targetId, randomUUID());
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'test')").run(workflowId);
  db.prepare("INSERT INTO workflow_steps (id, workflow_id, step_order, track, step_type, message_body, edges_json) VALUES (?, ?, 1, 'main', 'message', 'Hello', '{}')").run(stepId, workflowId);
  db.prepare("INSERT INTO runs (id, workflow_id, account_id, status) VALUES (?, ?, ?, 'running')").run(runId, workflowId, accountId);
  db.prepare("INSERT INTO run_profiles (id, target_id, run_id) VALUES (?, ?, ?)").run(runProfileId, targetId, runId);

  // Set profile to FAILED
  db.prepare("INSERT INTO run_profile_states (run_profile_id, current_step_id, state) VALUES (?, ?, 'failed')").run(runProfileId, stepId);
  db.prepare("INSERT INTO run_profile_tracks (id, run_profile_id, track, state) VALUES (?, ?, 'main', 'failed')").run(randomUUID(), runProfileId);

  // Call Unenroll API
  const req = { method: 'POST', query: { id: runId }, body: { target_id: targetId } } as any;
  const res = mockRes();
  await unenrollHandler(req, res);
  
  const state = db.prepare("SELECT state FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as any;
  // EXPECT it to be completed so the runner ignores it forever
  expect(state.state).toBe('completed');
  
  const track = db.prepare("SELECT state FROM run_profile_tracks WHERE run_profile_id = ?").get(runProfileId) as any;
  expect(track.state).toBe('skipped');
});

test('T-001 Finding 2: tickActions must be idempotent against outbound_events for a step', async () => {
  const accountId = randomUUID();
  const targetId = randomUUID();
  const workflowId = randomUUID();
  const runId = randomUUID();
  const runProfileId = randomUUID();
  const stepId = randomUUID();

  db.prepare("INSERT INTO accounts (id, name, email) VALUES (?, 'test', ?)").run(accountId, randomUUID());
  db.prepare("INSERT INTO targets (id, full_name, linkedin_url) VALUES (?, 'Test', ?)").run(targetId, randomUUID());
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'test')").run(workflowId);
  db.prepare("INSERT INTO workflow_steps (id, workflow_id, step_order, track, step_type, message_body, edges_json) VALUES (?, ?, 1, 'main', 'message', 'Hello', '{}')").run(stepId, workflowId);
  db.prepare("INSERT INTO runs (id, workflow_id, account_id, status) VALUES (?, ?, ?, 'running')").run(runId, workflowId, accountId);
  db.prepare("INSERT INTO run_profiles (id, target_id, run_id) VALUES (?, ?, ?)").run(runProfileId, targetId, runId);

  // 1. Target is pending on message step
  db.prepare("INSERT INTO run_profile_states (run_profile_id, current_step_id, state, next_eval_at) VALUES (?, ?, 'pending', datetime('now', '-1 day'))").run(runProfileId, stepId);

  // 2. We simulate that the side-effect ALREADY happened (e.g. from a previous tick that crashed before state update)
  db.prepare(`
    INSERT INTO outbound_events (id, run_id, run_profile_id, target_id, step_id, channel, sent_at, status, body)
    VALUES (?, ?, ?, ?, ?, 'linkedin', datetime('now'), 'sent', 'Hello')
  `).run(randomUUID(), runId, runProfileId, targetId, stepId);

  // We mock executeStep by modifying the actual behavior? 
  // Wait, tickActions calls executeStep which calls sendMessage which sends network request.
  // We can't let it actually execute Playwright in a fast vitest. We need a way to track if it tried.
  // Since we are checking idempotency, tickActions SHOULD NOT even call executeStep, or executeStep SHOULD NOT call sendMessage.
  // If it calls it, it will throw NotConnectedError because it's a dummy target.
  // So if it's properly idempotent, it will skip execution and immediately return SUCCESS, thus NO exception will be thrown, and state will become 'completed' (because no edges).
  
  await tickActions(db);

  // If idempotency works, state becomes completed without error
  const state = db.prepare("SELECT state FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as any;
  expect(state.state).toBe('completed');
  
  // And there should still be exactly ONE outbound event, not two.
  const events = db.prepare("SELECT COUNT(*) as c FROM outbound_events WHERE run_profile_id = ?").get(runProfileId) as any;
  expect(events.c).toBe(1);
});
