import { test, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { tickActions } from '../../lib/linkedin/runner';
import { getDb } from '../../lib/db';

let db: ReturnType<typeof getDb>;

beforeAll(() => {
  db = getDb();
});

test('delay node correctly pauses DAG execution and waits for next_eval_at', async () => {
  const targetId = randomUUID();
  const runId = randomUUID();
  const profileId = randomUUID();
  const workflowId = randomUUID();
  const stepId = randomUUID();
  const accountId = randomUUID();

  // Setup account & target
  db.prepare("INSERT INTO accounts (id, email, is_authenticated, name) VALUES (?, ?, 1, 'test')").run(accountId, "test-delay@test.com");
  db.prepare("INSERT INTO targets (id, full_name, linkedin_url) VALUES (?, 'Delay Target', ?)").run(targetId, randomUUID());
  
  // Setup workflow & delay step (60 seconds)
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'W')").run(workflowId);
  db.prepare("INSERT INTO workflow_steps (id, workflow_id, step_order, track, step_type, delay_seconds, edges_json) VALUES (?, ?, 1, 'main', 'delay', 60, '{}')").run(stepId, workflowId);
  
  // Setup run & run_profile (in 'pending' state)
  db.prepare("INSERT INTO runs (id, workflow_id, status) VALUES (?, ?, 'running')").run(runId, workflowId);
  db.prepare("INSERT INTO run_profiles (id, run_id, target_id) VALUES (?, ?, ?)").run(profileId, runId, targetId);
  db.prepare("INSERT INTO run_profile_states (run_profile_id, current_step_id, state) VALUES (?, ?, 'pending')").run(profileId, stepId);

  // 1. Tick engine for this target
  const stateBefore = db.prepare("SELECT * FROM run_profile_states WHERE run_profile_id = ?").get(profileId) as any;
  expect(stateBefore.state).toBe('pending');
  expect(stateBefore.next_eval_at).toBeNull();

  await tickActions(db, "test-worker");

  // 2. Verify state transitioned to 'running' and next_eval_at was set
  const stateAfterFirstTick = db.prepare("SELECT * FROM run_profile_states WHERE run_profile_id = ?").get(profileId) as any;
  expect(stateAfterFirstTick.state).toBe('running');
  expect(stateAfterFirstTick.next_eval_at).not.toBeNull();
  
  // Let's verify it actually set next_eval_at to the future
  const timeDiff = new Date(stateAfterFirstTick.next_eval_at + "Z").getTime() - Date.now();
  // Should be close to 60 seconds (60000 ms) in the future
  expect(timeDiff).toBeGreaterThan(50000);
  expect(timeDiff).toBeLessThan(65000);
});
