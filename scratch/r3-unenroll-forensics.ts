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
  const email = randomUUID();
  const url = randomUUID();

  // Insert base schema
  db.prepare("INSERT INTO accounts (id, name, email, active_hours_start, active_hours_end, working_days, timezone) VALUES (?, 'test', ?, 0, 24, '0,1,2,3,4,5,6', 'UTC')").run(accountId, email);
  db.prepare("INSERT INTO targets (id, full_name, linkedin_url) VALUES (?, 'Test Target', ?)").run(targetId, url);
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'test')").run(workflowId);
  db.prepare("INSERT INTO workflow_steps (id, workflow_id, step_order, track, step_type, message_body, edges_json) VALUES (?, ?, 1, 'main', 'message', 'Hello', '{}')").run(stepId, workflowId);
  db.prepare("INSERT INTO runs (id, workflow_id, account_id, status) VALUES (?, ?, ?, 'running')").run(runId, workflowId, accountId);
  db.prepare("INSERT INTO run_profiles (id, target_id, run_id) VALUES (?, ?, ?)").run(runProfileId, targetId, runId);
  
  // Set up running state
  db.prepare("INSERT INTO run_profile_states (run_profile_id, current_step_id, state) VALUES (?, ?, 'pending')").run(runProfileId, stepId);
  db.prepare("INSERT INTO run_profile_tracks (id, run_profile_id, track, state) VALUES (?, ?, 'main', 'in_progress')").run(randomUUID(), runProfileId);

  // User unenrolls via API
  db.prepare(`UPDATE run_profile_tracks SET state = 'skipped', error_message = 'Manually unenrolled' WHERE run_profile_id = ? AND state IN ('pending', 'in_progress')`).run(runProfileId);

  let track = db.prepare("SELECT * FROM run_profile_tracks WHERE run_profile_id = ?").get(runProfileId) as any;
  console.log("Track state after API unenroll:", track.state); // Expected: skipped

  // Runner executes and transitions state
  // We'll just simulate runner setting it to completed (or pending next step)
  db.prepare("UPDATE run_profile_states SET state = 'completed' WHERE run_profile_id = ?").run(runProfileId);

  track = db.prepare("SELECT * FROM run_profile_tracks WHERE run_profile_id = ?").get(runProfileId) as any;
  console.log("Track state after Runner update:", track.state); // Expected: completed (overwriting skipped!)
}

run();
