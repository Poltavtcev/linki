const fs = require('fs');
let code = fs.readFileSync('lib/linkedin/runner.ts', 'utf8');

const anchorBefore = `  // Auto-complete runs where ALL track-runs across all profiles are terminal`;
const insertion = `
  // Integration track enrollment — enroll directly without daily limits (handled per-provider)
  for (const run of activeRuns) {
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
`;

const toRemove = `  // Integration track enrollment — enroll directly without daily limits (handled per-provider)
  for (const run of stillActive) {
    const pendingIntegration = db.prepare(
      \`SELECT rt.id, rt.run_profile_id, rt.track FROM run_profile_tracks rt
       JOIN run_profiles rp ON rp.id = rt.run_profile_id
       WHERE rp.run_id = ? AND rt.track = 'integration' AND rt.state = 'pending'
       ORDER BY rt.id LIMIT 20\`
    ).all(run.run_id) as Array<{ id: string; run_profile_id: string; track: string }>;
    
    for (const row of pendingIntegration) {
      db.prepare(
        "UPDATE run_profile_tracks SET state = 'in_progress', next_step_at = datetime('now') WHERE id = ?"
      ).run(row.id);
    }
  }`;

code = code.replace(anchorBefore, insertion + anchorBefore);
code = code.replace(toRemove, '');
fs.writeFileSync('lib/linkedin/runner.ts', code);
