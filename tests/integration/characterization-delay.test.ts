import { test, expect, beforeAll, vi } from 'vitest';
import { getDb } from '@/lib/db';
import { tickActions } from '@/lib/linkedin/runner';
import { randomUUID } from 'crypto';

// Setup mock for page and message sender to observe side-effects
vi.mock('@/lib/linkedin/session', () => ({
  getSessionPage: vi.fn().mockResolvedValue({
    goto: vi.fn(),
    waitForTimeout: vi.fn(),
    close: vi.fn(),
    locator: vi.fn().mockReturnValue({ click: vi.fn(), fill: vi.fn(), count: vi.fn().mockResolvedValue(1) })
  }),
  saveSessionState: vi.fn()
}));

vi.mock('@/lib/linkedin/message', () => ({
  sendMessage: vi.fn().mockResolvedValue({ messagingUrn: 'urn:li:mock' })
}));

test('Characterization: Legacy Delay node does not duplicate execution (Regression Test)', async () => {
  const db = getDb();
  
  const accountId = randomUUID();
  const targetId = randomUUID();
  const workflowId = randomUUID();
  const runId = randomUUID();
  const runProfileId = randomUUID();
  const stepId = randomUUID();

  // Insert base schema
  db.prepare("INSERT INTO accounts (id, name, email, active_hours_start, active_hours_end, working_days, timezone) VALUES (?, 'test', 't', 0, 24, '0,1,2,3,4,5,6', 'UTC')").run(accountId);
  db.prepare("INSERT INTO targets (id, full_name, linkedin_url) VALUES (?, 'Test Target', 'http://linkedin.com/in/test')").run(targetId);
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'test')").run(workflowId);
  
  // Create a message step with a delay_seconds = 3600 (legacy invalid state)
  db.prepare("INSERT INTO workflow_steps (id, workflow_id, step_order, track, step_type, message_body, delay_seconds, edges_json) VALUES (?, ?, 1, 'main', 'message', 'Hello', 3600, '{}')").run(stepId, workflowId);
  
  db.prepare("INSERT INTO runs (id, workflow_id, account_id, status) VALUES (?, ?, ?, 'running')").run(runId, workflowId, accountId);
  db.prepare("INSERT INTO run_profiles (id, target_id, run_id) VALUES (?, ?, ?)").run(runProfileId, targetId, runId);
  db.prepare("INSERT INTO run_profile_tracks (id, run_profile_id, track) VALUES (?, ?, 'main')").run(randomUUID(), runProfileId);
  
  // Starting state: pending
  db.prepare("INSERT INTO run_profile_states (run_profile_id, current_step_id, state) VALUES (?, ?, 'pending')").run(runProfileId, stepId);

  // Tick 1
  // BRANCH EXPECTED: runner.ts tickActions executes the action.
  // Since it's a message node (not a 'delay' node), the delay interceptor ignores it.
  // It routes to the next edge. Since edges_json is empty, it completes immediately.
  await tickActions(db);

  const state = db.prepare("SELECT * FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as any;
  expect(state.state).toBe('running');
  
  const events = db.prepare("SELECT * FROM outbound_events WHERE run_profile_id = ?").all(runProfileId) as any[];
  expect(events.length).toBe(1); // Executed exactly once
});
