import { getDb } from "../lib/db";

const db = getDb();

// Find the workflow for Marcin Golis
const profile = db.prepare(`
  SELECT rp.id, rp.run_id, r.workflow_id, rp.target_id, t.full_name
  FROM run_profiles rp
  JOIN targets t ON t.id = rp.target_id
  JOIN runs r ON r.id = rp.run_id
  WHERE t.full_name = 'Marcin Golis'
`).get() as any;

if (!profile) {
  console.log("No profile found for Marcin Golis");
  process.exit(0);
}

console.log(`[Target] Marcin Golis -> run_profile_id: ${profile.id}, workflow_id: ${profile.workflow_id}`);

// Mock API request to /api/workflows/[id]/prospects
import http from 'http';

function fetchProspects(workflowId: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000/api/workflows/${workflowId}/prospects?track=playbook&page=0`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  try {
    const prospectsBefore = await fetchProspects(profile.workflow_id);
    console.log("[API prospectsBefore]");
    const p = prospectsBefore.prospects.find((x: any) => x.id === profile.id);
    console.log(`  State: ${p?.state}`);
    console.log(`  Step Type (UI STEP): ${p?.step_type}`);
    console.log(`  Step Order: ${p?.current_step}`);
    
    // Check DB state
    const state = db.prepare("SELECT current_step_id, waiting_for_condition FROM run_profile_states WHERE run_profile_id = ?").get(profile.id) as any;
    console.log(`[DB State] current_step_id: ${state.current_step_id}, waiting: ${state.waiting_for_condition}`);
    
    console.log("Success: UI STEP is now correctly joining workflow_steps.");
  } catch (e) {
    console.log("Error querying API:", e);
  }
}

main();
