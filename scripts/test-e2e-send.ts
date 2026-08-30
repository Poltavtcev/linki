import { getDb } from "../lib/db";

async function main() {
  const db = getDb();
  const targetUrl = "https://www.linkedin.com/in/poltavcev/";

  const target = db.prepare("SELECT id FROM targets WHERE linkedin_url LIKE ?").get(`%${targetUrl}%`) as { id: string } | undefined;
  if (!target) {
    console.error(`Target not found for URL: ${targetUrl}`);
    process.exit(1);
  }

  // Force degree = 1
  db.prepare("UPDATE targets SET degree = 1 WHERE id = ?").run(target.id);
  console.log(`Set degree = 1 for target ${target.id}`);

  // Force the track to be pending and clear next_step_at
  const result = db.prepare(`
    UPDATE run_profile_tracks 
    SET next_step_at = NULL, state = 'pending', error_message = NULL
    WHERE run_profile_id IN (SELECT id FROM run_profiles WHERE target_id = ?)
      AND track = 'linkedin'
  `).run(target.id);

  console.log(`Reset next_step_at and state for ${result.changes} tracks.`);

  // Force the RUN to be 'running'
  db.prepare(`
    UPDATE runs 
    SET status = 'running', completed_at = NULL 
    WHERE id IN (SELECT run_id FROM run_profiles WHERE target_id = ?)
  `).run(target.id);
  console.log(`Reset run status to 'running'`);

  console.log("The background runner should now pick this up within the next 15 seconds.");
}

main().catch(console.error);
