const assert = require('assert');

// A script that can be run in the Docker container to test cascades
function testTargetDeleteCascade(db) {
  // Ensure foreign keys are on
  db.pragma('foreign_keys = ON');

  // Insert mock data
  db.exec("INSERT INTO targets (id) VALUES ('test-target-1'), ('test-target-2')");
  db.exec("INSERT INTO runs (id) VALUES ('test-run-1')");
  
  db.exec("INSERT INTO run_profiles (id, run_id, target_id) VALUES ('rp-test-1', 'test-run-1', 'test-target-1'), ('rp-test-2', 'test-run-1', 'test-target-2')");
  db.exec("INSERT INTO run_profile_tracks (id, run_profile_id) VALUES ('rpt-test-1', 'rp-test-1'), ('rpt-test-2', 'rp-test-2')");
  db.exec("INSERT INTO logs (id, target_id) VALUES ('log-test-1', 'test-target-1'), ('log-test-2', 'test-target-2')");
  db.exec("INSERT INTO email_replies (id, target_id, run_id, from_email, body_text, received_at, manually_edited) VALUES ('er-test-1', 'test-target-1', 'test-run-1', 'test@example.com', 'test', datetime('now'), 0)");
  db.exec("INSERT INTO agent_sessions (id, target_id, run_id) VALUES ('as-test-1', 'test-target-1', 'test-run-1')");

  // Perform deletion
  db.transaction(() => {
    db.prepare("DELETE FROM targets WHERE id = ?").run('test-target-1');
  })();

  // Assertions for T1 (should be deleted)
  const getCount = (table, idCol, idVal) => db.prepare(`SELECT COUNT(*) as c FROM ${table} WHERE ${idCol} = ?`).get(idVal).c;

  assert.strictEqual(getCount('targets', 'id', 'test-target-1'), 0, "target not deleted");
  assert.strictEqual(getCount('run_profiles', 'target_id', 'test-target-1'), 0, "run_profiles not deleted");
  assert.strictEqual(getCount('run_profile_tracks', 'id', 'rpt-test-1'), 0, "run_profile_tracks not deleted");
  assert.strictEqual(getCount('logs', 'target_id', 'test-target-1'), 0, "logs not deleted");
  assert.strictEqual(getCount('email_replies', 'target_id', 'test-target-1'), 0, "email_replies not deleted");
  assert.strictEqual(getCount('agent_sessions', 'target_id', 'test-target-1'), 0, "agent_sessions not deleted");

  // Assertions for T2 & Run (should be preserved)
  assert.strictEqual(getCount('targets', 'id', 'test-target-2'), 1, "target 2 deleted");
  assert.strictEqual(getCount('run_profiles', 'target_id', 'test-target-2'), 1, "run_profiles for t2 deleted");
  assert.strictEqual(getCount('runs', 'id', 'test-run-1'), 1, "runs deleted");

  console.log("✅ Regression tests passed!");
  
  // Cleanup
  db.exec("DELETE FROM targets WHERE id = 'test-target-2'");
  db.exec("DELETE FROM runs WHERE id = 'test-run-1'");
}

module.exports = { testTargetDeleteCascade };

if (require.main === module) {
  try {
    const { getDb } = require('../lib/db');
    const db = getDb();
    testTargetDeleteCascade(db);
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND' && e.message.includes('better-sqlite3')) {
      console.log("To run these tests locally, execute this script inside your docker container where better-sqlite3 is compiled.");
    } else {
      console.error(e);
    }
  }
}
