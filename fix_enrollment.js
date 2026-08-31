const fs = require('fs');
let code = fs.readFileSync('lib/linkedin/runner.ts', 'utf8');

const anchor = `  // Apply daily limits — separate due track-runs into execute vs reschedule`;

const injection = `  // Integration track enrollment — enroll directly without daily limits (handled per-provider)
  for (const run of stillActive) {
    const pendingIntegration = db.prepare(
      \`SELECT rt.id, rt.run_profile_id, rt.track FROM run_profile_tracks rt
       JOIN run_profiles rp ON rp.id = rt.run_profile_id
       WHERE rp.run_id = ? AND rt.track = 'integration' AND rt.state = 'pending'
       ORDER BY rt.id LIMIT 20\`
    ).all(run.run_id);
    
    for (const row of pendingIntegration) {
      db.prepare(
        "UPDATE run_profile_tracks SET state = 'in_progress', next_step_at = datetime('now') WHERE id = ?"
      ).run(row.id);
    }
  }

  // Apply daily limits — separate due track-runs into execute vs reschedule`;

code = code.replace(anchor, injection);
fs.writeFileSync('lib/linkedin/runner.ts', code);
