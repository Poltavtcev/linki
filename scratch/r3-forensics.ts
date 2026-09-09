import { getDb } from '../lib/db';
import { tickActions } from '../lib/linkedin/runner';
import { randomUUID } from 'crypto';
import * as vi from 'vitest';

async function run() {
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
  db.prepare("INSERT INTO workflow_steps (id, workflow_id, step_order, track, step_type, message_body, edges_json) VALUES (?, ?, 1, 'main', 'message', 'Hello', '{}')").run(stepId, workflowId);
  db.prepare("INSERT INTO runs (id, workflow_id, account_id, status) VALUES (?, ?, ?, 'running')").run(runId, workflowId, accountId);
  db.prepare("INSERT INTO run_profiles (id, target_id, run_id) VALUES (?, ?, ?)").run(runProfileId, targetId, runId);
  
  // Set up running state
  db.prepare("INSERT INTO run_profile_states (run_profile_id, current_step_id, state) VALUES (?, ?, 'pending')").run(runProfileId, stepId);

  // We want to force a FAILED state in runner. 
  // Let's modify the DB to simulate executeStep failing.
  // Actually, we can just insert the failed state directly to test `retry.ts`.
  db.prepare("UPDATE run_profile_states SET state = 'failed' WHERE run_profile_id = ?").run(runProfileId);
  db.prepare("INSERT INTO run_profile_tracks (id, run_profile_id, track, state) VALUES (?, ?, 'main', 'failed')").run(randomUUID(), runProfileId);

  // NOW simulate what retry.ts does
  db.prepare(`UPDATE run_profile_tracks SET state = 'in_progress', error_message = NULL, next_step_at = NULL WHERE run_profile_id = ? AND state = 'failed'`).run(runProfileId);

  // Check state
  const state = db.prepare("SELECT * FROM run_profile_states WHERE run_profile_id = ?").get(runProfileId);
  const track = db.prepare("SELECT * FROM run_profile_tracks WHERE run_profile_id = ?").get(runProfileId);
  console.log("State machine (States):", state);
  console.log("UI Projection (Tracks):", track);
}

run();
