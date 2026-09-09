import { getDb } from "../lib/db";
import { tickActions } from "../lib/linkedin/runner";

const db = getDb();
console.log("Running tickActions...");
tickActions(db).then(() => {
  console.log("tickActions completed.");
  const state = db.prepare("SELECT current_step_id, waiting_for_condition, state FROM run_profile_states WHERE run_profile_id = 'f4bf9c37-2646-4a50-bdb7-2d02b160e78d'").get();
  console.log("Post-tick state:", state);
}).catch(console.error);
