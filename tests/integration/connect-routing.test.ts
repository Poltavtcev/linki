import { test, expect, vi } from 'vitest';
import { getDb } from '@/lib/db';
import { syncAcceptedConnections } from '@/lib/linkedin/sync-accepted';
import { randomUUID } from 'crypto';

// Global vanities array to feed the mock
let mockVanities: string[] = [];

// Setup mock for page and session
vi.mock('@/lib/linkedin/session', () => ({
  getSessionPage: vi.fn().mockResolvedValue({
    url: vi.fn().mockReturnValue('https://www.linkedin.com/feed/'),
    goto: vi.fn().mockResolvedValue(null),
    close: vi.fn(),
    waitForTimeout: vi.fn(),
    evaluate: vi.fn().mockImplementation(async (fn, args) => {
      // Mock fetchConnectionsPage
      if (fn.toString().includes('relationships/dash/connections')) {
        // Return mock connections for all vanities currently in mockVanities
        return mockVanities.map(vanity => ({ createdAt: Date.now(), vanity }));
      }
      // Mock fetchContactInfoEmail
      if (fn.toString().includes('profileContactInfo')) {
        return null;
      }
      // Mock extractTotalConnections
      if (fn.toString().includes('mn-connections__header')) {
        return mockVanities.length;
      }
      return null;
    })
  }),
  saveSessionState: vi.fn(),
  markNeedsReauth: vi.fn()
}));

function setupWorkflow(db: ReturnType<typeof getDb>, steps: any[]) {
  const accountId = randomUUID();
  const emailAccountId = randomUUID();
  const targetId = randomUUID();
  const workflowId = randomUUID();
  const runId = randomUUID();
  const runProfileId = randomUUID();
  const emailRandom = randomUUID() + '@example.com';
  
  const vanity = 'test-vanity-' + randomUUID();
  mockVanities = [vanity];
  const liUrl = 'http://linkedin.com/in/' + vanity + '/';

  db.prepare("INSERT INTO accounts (id, name, email, active_hours_start, active_hours_end, working_days, timezone, is_authenticated) VALUES (?, 'test', ?, 0, 24, '0,1,2,3,4,5,6', 'UTC', 1)").run(accountId, emailRandom);
  db.prepare("INSERT INTO email_accounts (id, name, from_email, smtp_host, username, password, active_hours_start, active_hours_end, working_days, timezone, is_verified) VALUES (?, 'Test Email', ?, 'host', 'u', 'pw', 0, 24, '0,1,2,3,4,5,6', 'UTC', 1)").run(emailAccountId, emailRandom);
  
  db.prepare("INSERT INTO targets (id, full_name, linkedin_url, email, connection_requested_at) VALUES (?, 'Test Target', ?, ?, datetime('now', '-1 day'))").run(targetId, liUrl, emailRandom);
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
  db.prepare("INSERT INTO run_profile_states (run_profile_id, current_step_id, state, waiting_for_condition) VALUES (?, ?, 'running', 'accept')").run(runProfileId, firstStep.id);

  return { accountId, runProfileId, targetId };
}

test('Connect node with ONLY on_accepted edge (Production-coupled)', async () => {
  const db = getDb();
  const connectStep = randomUUID();
  const nextStep = randomUUID();

  const { accountId, runProfileId } = setupWorkflow(db, [
    { id: connectStep, order: 1, type: 'connect', edges: { on_accepted: nextStep } },
    { id: nextStep, order: 2, type: 'message', message: 'Hi', edges: {} }
  ]);

  await syncAcceptedConnections(accountId);
  
  const state = db.prepare("SELECT * FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as any;
  expect(state.waiting_for_condition).toBeNull();
  expect(state.current_step_id).toBe(nextStep);
});

test('Connect node with ONLY next edge (Production-coupled)', async () => {
  const db = getDb();
  const connectStep = randomUUID();
  const nextStep = randomUUID();

  const { accountId, runProfileId } = setupWorkflow(db, [
    { id: connectStep, order: 1, type: 'connect', edges: { next: nextStep } },
    { id: nextStep, order: 2, type: 'message', message: 'Hi', edges: {} }
  ]);

  await syncAcceptedConnections(accountId);
  
  const state = db.prepare("SELECT * FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as any;
  expect(state.waiting_for_condition).toBeNull();
  expect(state.current_step_id).toBe(nextStep);
});

test('Connect node with NO edges (Production-coupled)', async () => {
  const db = getDb();
  const connectStep = randomUUID();

  const { accountId, runProfileId } = setupWorkflow(db, [
    { id: connectStep, order: 1, type: 'connect', edges: {} },
  ]);

  await syncAcceptedConnections(accountId);
  
  const state = db.prepare("SELECT * FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as any;
  expect(state.waiting_for_condition).toBeNull();
  expect(state.current_step_id).toBeNull();
});
