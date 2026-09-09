import { test, expect, beforeAll, vi } from 'vitest';
import { getDb } from '@/lib/db';
import { tickActions } from '@/lib/linkedin/runner';
import { randomUUID } from 'crypto';

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

vi.mock('@/lib/email/sender', () => ({
  sendEmail: vi.fn().mockResolvedValue('msg-id-123')
}));

function setupWorkflow(db: ReturnType<typeof getDb>, steps: any[]) {
  const accountId = randomUUID();
  const emailAccountId = randomUUID();
  const targetId = randomUUID();
  const workflowId = randomUUID();
  const runId = randomUUID();
  const runProfileId = randomUUID();
  const emailRandom = randomUUID() + '@example.com';
  const liUrl = 'http://linkedin.com/in/' + randomUUID();

  db.prepare("INSERT INTO accounts (id, name, email, active_hours_start, active_hours_end, working_days, timezone, is_authenticated) VALUES (?, 'test', ?, 0, 24, '0,1,2,3,4,5,6', 'UTC', 1)").run(accountId, emailRandom);
  db.prepare("INSERT INTO email_accounts (id, name, from_email, smtp_host, username, password, active_hours_start, active_hours_end, working_days, timezone, is_verified) VALUES (?, 'Test Email', ?, 'host', 'u', 'pw', 0, 24, '0,1,2,3,4,5,6', 'UTC', 1)").run(emailAccountId, emailRandom);
  
  db.prepare("INSERT INTO targets (id, full_name, linkedin_url, email) VALUES (?, 'Test Target', ?, ?)").run(targetId, liUrl, emailRandom);
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'test')").run(workflowId);
  
  steps.forEach(step => {
    db.prepare("INSERT INTO workflow_steps (id, workflow_id, step_order, track, step_type, message_body, email_subject, email_body, delay_seconds, edges_json) VALUES (?, ?, ?, 'main', ?, ?, ?, ?, ?, ?)").run(
      step.id, workflowId, step.order, step.type, step.message || null, step.emailSubject || null, step.emailBody || null, step.delaySeconds || 0, JSON.stringify(step.edges || {})
    );
  });

  db.prepare("INSERT INTO runs (id, workflow_id, account_id, email_account_id, status) VALUES (?, ?, ?, ?, 'running')").run(runId, workflowId, accountId, emailAccountId);
  db.prepare("INSERT INTO run_profiles (id, target_id, run_id, email_account_id) VALUES (?, ?, ?, ?)").run(runProfileId, targetId, runId, emailAccountId);
  db.prepare("INSERT INTO run_profile_tracks (id, run_profile_id, track) VALUES (?, ?, 'main')").run(randomUUID(), runProfileId);
  
  const firstStep = steps.find(s => s.order === 1);
  db.prepare("INSERT INTO run_profile_states (run_profile_id, current_step_id, state) VALUES (?, ?, 'pending')").run(runProfileId, firstStep.id);

  return { runProfileId };
}

test('A. Delay execution (Message -> Delay 1h -> Email)', async () => {
  const db = getDb();
  const msgStep = randomUUID();
  const delayStep = randomUUID();
  const emailStep = randomUUID();

  const { runProfileId } = setupWorkflow(db, [
    { id: msgStep, order: 1, type: 'message', message: 'Hi', edges: { next: delayStep } },
    { id: delayStep, order: 2, type: 'delay', delaySeconds: 3600, edges: { next: emailStep } },
    { id: emailStep, order: 3, type: 'email', emailSubject: 'S', emailBody: 'B', edges: {} }
  ]);

  await tickActions(db);
  let state = db.prepare("SELECT * FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as any;
  expect(state.current_step_id).toBe(delayStep);
  expect(state.state).toBe('pending');
  let events = db.prepare("SELECT * FROM outbound_events WHERE run_profile_id = ?").all(runProfileId) as any[];
  expect(events.length).toBe(1);

  await tickActions(db);
  state = db.prepare("SELECT * FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as any;
  expect(state.current_step_id).toBe(delayStep);
  expect(state.state).toBe('running');
  events = db.prepare("SELECT * FROM outbound_events WHERE run_profile_id = ?").all(runProfileId) as any[];
  expect(events.length).toBe(1);

  db.prepare("UPDATE run_profile_states SET next_eval_at = datetime('now', '-1 minute') WHERE run_profile_id = ?").run(runProfileId);

  await tickActions(db);
  state = db.prepare("SELECT * FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as any;
  expect(state.current_step_id).toBe(emailStep);
  expect(state.state).toBe('pending');
  events = db.prepare("SELECT * FROM outbound_events WHERE run_profile_id = ?").all(runProfileId) as any[];
  expect(events.length).toBe(1);

  await tickActions(db);
  state = db.prepare("SELECT * FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as any;
    expect(state.state).toBe('completed');
  events = db.prepare("SELECT * FROM outbound_events WHERE run_profile_id = ?").all(runProfileId) as any[];
  expect(events.length).toBe(2);
});

test('B. Delay terminal (Message -> Delay -> END)', async () => {
  const db = getDb();
  const msgStep = randomUUID();
  const delayStep = randomUUID();

  const { runProfileId } = setupWorkflow(db, [
    { id: msgStep, order: 1, type: 'message', message: 'Hi', edges: { next: delayStep } },
    { id: delayStep, order: 2, type: 'delay', delaySeconds: 3600, edges: {} }
  ]);

  await tickActions(db);
  let events = db.prepare("SELECT * FROM outbound_events WHERE run_profile_id = ?").all(runProfileId) as any[];
  expect(events.length).toBe(1);

  await tickActions(db);
  let state = db.prepare("SELECT * FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as any;
  expect(state.state).toBe('running');

  db.prepare("UPDATE run_profile_states SET next_eval_at = datetime('now', '-1 minute') WHERE run_profile_id = ?").run(runProfileId);

  await tickActions(db);
  state = db.prepare("SELECT * FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as any;
    expect(state.state).toBe('completed');
  events = db.prepare("SELECT * FROM outbound_events WHERE run_profile_id = ?").all(runProfileId) as any[];
  expect(events.length).toBe(1);
});

test('C. Multiple delays (Message -> Delay -> Email -> Delay -> Message)', async () => {
  const db = getDb();
  const s1 = randomUUID(), d1 = randomUUID(), s2 = randomUUID(), d2 = randomUUID(), s3 = randomUUID();

  const { runProfileId } = setupWorkflow(db, [
    { id: s1, order: 1, type: 'message', message: 'M1', edges: { next: d1 } },
    { id: d1, order: 2, type: 'delay', delaySeconds: 10, edges: { next: s2 } },
    { id: s2, order: 3, type: 'email', emailSubject: 'E1', emailBody: 'B', edges: { next: d2 } },
    { id: d2, order: 4, type: 'delay', delaySeconds: 10, edges: { next: s3 } },
    { id: s3, order: 5, type: 'message', message: 'M2', edges: {} },
  ]);

  for (let i = 0; i < 10; i++) {
    await tickActions(db);
    db.prepare("UPDATE run_profile_states SET next_eval_at = datetime('now', '-1 minute') WHERE run_profile_id = ? AND state = 'running'").run(runProfileId);
  }

  const state = db.prepare("SELECT * FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as any;
    expect(state.state).toBe('completed');

  const events = db.prepare("SELECT * FROM outbound_events WHERE run_profile_id = ? ORDER BY step_id").all(runProfileId) as any[];
  expect(events.length).toBe(3);
});

test('D. No-delay regression (Message -> Email)', async () => {
  const db = getDb();
  const m1 = randomUUID(), e1 = randomUUID();

  const { runProfileId } = setupWorkflow(db, [
    { id: m1, order: 1, type: 'message', message: 'M1', edges: { next: e1 } },
    { id: e1, order: 2, type: 'email', emailSubject: 'E1', emailBody: 'B', edges: {} },
  ]);

  await tickActions(db);
  await tickActions(db);
  
  const state = db.prepare("SELECT * FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as any;
    expect(state.state).toBe('completed');

  const events = db.prepare("SELECT * FROM outbound_events WHERE run_profile_id = ?").all(runProfileId) as any[];
  expect(events.length).toBe(2);
});

test('E. Legacy Action Step (Message + delay_seconds > 0) does not duplicate', async () => {
  const db = getDb();
  const msgStep = randomUUID();

  const { runProfileId } = setupWorkflow(db, [
    { id: msgStep, order: 1, type: 'message', message: 'Hi', delaySeconds: 3600, edges: {} }
  ]);

  await tickActions(db);
  const state = db.prepare("SELECT * FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as any;
  
    expect(state.state).toBe('running');
  
  const events = db.prepare("SELECT * FROM outbound_events WHERE run_profile_id = ?").all(runProfileId) as any[];
  expect(events.length).toBe(1);
});
