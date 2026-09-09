import { expect, test, beforeAll, vi, afterEach } from 'vitest';
import { getDb } from '@/lib/db';
import { tickActions } from '@/lib/linkedin/runner';
import { processReply } from '@/ee/index';
import * as messageModule from '@/lib/linkedin/message';
import * as sessionModule from '@/lib/linkedin/session';
import { randomUUID } from 'crypto';

let db: ReturnType<typeof getDb>;

beforeAll(() => {
  db = getDb();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('F-07/F-08: Unenroll/Bounce Race Condition', async () => {
  const targetId = randomUUID();
  const runProfileId = randomUUID();
  const stepId = randomUUID();
  const accountId = randomUUID();
  const workflowId = randomUUID();
  const runId = randomUUID();
  
  db.prepare("INSERT INTO accounts (id, name, email) VALUES (?, 'test', ?)").run(accountId, randomUUID());
  db.prepare("INSERT INTO targets (id, full_name, messaging_urn, linkedin_url) VALUES (?, 'Test Target', 'urn:li:test', 'https://linkedin.com/in/test')").run(targetId);
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'Race WF')").run(workflowId);
  db.prepare("INSERT INTO workflow_steps (id, workflow_id, step_order, track, step_type) VALUES (?, ?, 1, 'main', 'message')").run(stepId, workflowId);
  db.prepare("INSERT INTO runs (id, workflow_id, account_id, status) VALUES (?, ?, ?, 'running')").run(runId, workflowId, accountId);
  db.prepare("INSERT INTO run_profiles (id, target_id, run_id) VALUES (?, ?, ?)").run(runProfileId, targetId, runId);
  
  // Set to pending so tickActions picks it up
  db.prepare("INSERT INTO run_profile_states (run_profile_id, current_step_id, state) VALUES (?, ?, 'pending')").run(runProfileId, stepId);

  // Mock sendMessage to simulate the race
  vi.spyOn(messageModule, 'sendMessage').mockImplementation(async () => {
    // RACE: While message is being sent (inflight), an API call unenrolled the target
    db.prepare("UPDATE run_profile_states SET state = 'completed' WHERE run_profile_id = ?").run(runProfileId);
    return { messagingUrn: 'urn:li:test' } as any;
  });
  
  vi.spyOn(sessionModule as any, 'getSessionPage').mockImplementation(async () => ({ close: async () => {} } as any));
  vi.spyOn(sessionModule as any, 'saveSessionState').mockImplementation(async () => {});

  await tickActions(db);

  const state = db.prepare("SELECT state FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as { state: string };
  // EXPECT: It should remain completed.
  // ACTUAL in unfixed code: tickActions overwrites it with 'pending' or 'completed'
  expect(state.state).toBe('completed');
});

test('F-01: Email Reply Double-Mutation (Deterministic vs Heuristic)', async () => {
  const targetId = randomUUID();
  const runProfileId = randomUUID();
  const stepA = randomUUID(); 
  const stepB = randomUUID(); 
  const workflowId = randomUUID();
  const accountId = randomUUID();
  const runId = randomUUID();
  
  db.prepare("INSERT INTO accounts (id, name, email) VALUES (?, 'test', ?)").run(accountId, randomUUID());
  db.prepare("INSERT INTO targets (id, full_name) VALUES (?, 'Target F01')").run(targetId);
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'WF F01')").run(workflowId);
  
  // Create steps
  db.prepare("INSERT INTO workflow_steps (id, workflow_id, step_order, track, step_type, edges_json) VALUES (?, ?, 1, 'main', 'email', ?)").run(stepA, workflowId, JSON.stringify({ on_replied: 'stepA-reply' }));
  db.prepare("INSERT INTO workflow_steps (id, workflow_id, step_order, track, step_type, edges_json) VALUES (?, ?, 2, 'main', 'email', ?)").run(stepB, workflowId, JSON.stringify({ on_replied: 'stepB-reply' }));
  
  db.prepare("INSERT INTO runs (id, workflow_id, account_id, status) VALUES (?, ?, ?, 'running')").run(runId, workflowId, accountId);
  db.prepare("INSERT INTO run_profiles (id, target_id, run_id) VALUES (?, ?, ?)").run(runProfileId, targetId, runId);
  
  // Set state to stepA-reply (simulate deterministic routing already resolved the reply to Step A's on_replied edge)
  db.prepare("INSERT INTO run_profile_states (run_profile_id, current_step_id, state) VALUES (?, ?, 'pending')").run(runProfileId, 'stepA-reply');
  
  // Create the reply steps so processReply can query step_order
  db.prepare("INSERT INTO workflow_steps (id, workflow_id, step_order, track, step_type) VALUES ('stepA-reply', ?, 3, 'main', 'delay')").run(workflowId);
  db.prepare("INSERT INTO workflow_steps (id, workflow_id, step_order, track, step_type) VALUES ('stepB-reply', ?, 4, 'main', 'delay')").run(workflowId);
  
  // Run heuristic
  await processReply(targetId, 'email', 'reply text', randomUUID());
  
  const finalState = db.prepare("SELECT current_step_id FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as any;
  
  // EXPECT: state should remain 'stepA-reply' because deterministic correlation already routed it.
  // ACTUAL: processReply overrides it to 'stepB-reply' because it matches lastMessageStep <= 3 (which is step 2).
  expect(finalState.current_step_id).toBe('stepA-reply');
});

test('F-02: processReply case sensitivity for paused state', async () => {
  const targetId = randomUUID();
  const runProfileId = randomUUID();
  const workflowId = randomUUID();
  const accountId = randomUUID();
  const runId = randomUUID();
  
  db.prepare("INSERT INTO accounts (id, name, email) VALUES (?, 'test', ?)").run(accountId, randomUUID());
  db.prepare("INSERT INTO targets (id, full_name) VALUES (?, 'Target F02')").run(targetId);
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'WF F02')").run(workflowId);
  db.prepare("INSERT INTO workflow_steps (id, workflow_id, step_order, track, step_type, edges_json) VALUES ('step-f02', ?, 1, 'main', 'email', '{\"on_replied\":\"step-f02-reply\"}')").run(workflowId);
  db.prepare("INSERT INTO runs (id, workflow_id, account_id, status) VALUES (?, ?, ?, 'running')").run(runId, workflowId, accountId);
  db.prepare("INSERT INTO run_profiles (id, target_id, run_id) VALUES (?, ?, ?)").run(runProfileId, targetId, runId);
  
  // State is 'paused' (lowercase, canonical)
  db.prepare("INSERT INTO run_profile_states (run_profile_id, current_step_id, state) VALUES (?, 'step-f02', 'paused')").run(runProfileId);
  
  await processReply(targetId, 'email', 'hello', randomUUID());
  
  const finalState = db.prepare("SELECT current_step_id, state FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId) as any;
  
  // EXPECT: processReply should process the reply, updating state to 'pending' and step to 'step-f02-reply'
  expect(finalState.state).toBe('pending');
  expect(finalState.current_step_id).toBe('step-f02-reply');
});

test('F-05: Missing assertLock before side-effect in runner.ts', async () => {
  const targetId = randomUUID();
  const runProfileId = randomUUID();
  const workflowId = randomUUID();
  const accountId = randomUUID();
  const runId = randomUUID();
  
  db.prepare("INSERT INTO accounts (id, name, email) VALUES (?, 'test', ?)").run(accountId, randomUUID());
  db.prepare("INSERT INTO targets (id, full_name, messaging_urn, linkedin_url) VALUES (?, 'Target F05', 'urn:li:test', 'https://linkedin.com/in/test-f05')").run(targetId);
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'WF F05')").run(workflowId);
  db.prepare("INSERT INTO workflow_steps (id, workflow_id, step_order, track, step_type) VALUES ('step-f05', ?, 1, 'main', 'message')").run(workflowId);
  db.prepare("INSERT INTO runs (id, workflow_id, account_id, status) VALUES (?, ?, ?, 'running')").run(runId, workflowId, accountId);
  db.prepare("INSERT INTO run_profiles (id, target_id, run_id) VALUES (?, ?, ?)").run(runProfileId, targetId, runId);
  db.prepare("INSERT INTO run_profile_states (run_profile_id, current_step_id, state) VALUES (?, 'step-f05', 'pending')").run(runProfileId);

  let lockArg: any = null;
  vi.spyOn(messageModule, 'sendMessage').mockImplementation(async (...args) => {
    lockArg = args[5];
    return { messagingUrn: 'urn:li:test' } as any;
  });
  
  vi.spyOn(sessionModule as any, 'getSessionPage').mockImplementation(async () => ({ close: async () => {} } as any));
  vi.spyOn(sessionModule as any, 'saveSessionState').mockImplementation(async () => {});

  await tickActions(db);
  
  // EXPECT: assertLock should be passed to sendMessage (a function)
  // ACTUAL: it is undefined because runner.ts fails to pass it
  expect(typeof lockArg).toBe('function');
});

test('F-10: Sync Trigger Hides paused state', async () => {
  const targetId = randomUUID();
  const runProfileId = randomUUID();
  
  const workflowId = randomUUID();
  const runId = randomUUID();
  
  db.prepare("INSERT INTO targets (id, full_name) VALUES (?, 'Target F10')").run(targetId);
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'WF F10')").run(workflowId);
  db.prepare("INSERT INTO runs (id, workflow_id, status) VALUES (?, ?, 'running')").run(runId, workflowId);
  db.prepare("INSERT INTO run_profiles (id, target_id, run_id) VALUES (?, ?, ?)").run(runProfileId, targetId, runId);
  
  db.prepare("INSERT INTO run_profile_tracks (run_profile_id, track, state) VALUES (?, 'main', 'pending')").run(runProfileId);
  db.prepare("INSERT INTO run_profile_states (run_profile_id, current_step_id, state) VALUES (?, 'step', 'pending')").run(runProfileId);
  
  db.prepare("UPDATE run_profile_states SET state = 'paused' WHERE run_profile_id = ?").run(runProfileId);
  
  const track = db.prepare("SELECT state FROM run_profile_tracks WHERE run_profile_id = ?").get(runProfileId) as any;
  
  // EXPECT: track state matches canonical state 'paused'
  expect(track.state).toBe('paused');
});
