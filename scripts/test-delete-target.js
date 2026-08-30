const Database = require('better-sqlite3');
const assert = require('assert');

// Note: we'll simulate the schema, including the new ON DELETE CASCADE rules
const db = new Database(':memory:');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE targets (
    id TEXT PRIMARY KEY
  );

  CREATE TABLE runs (
    id TEXT PRIMARY KEY
  );

  CREATE TABLE run_profiles (
    id TEXT PRIMARY KEY,
    run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,
    target_id TEXT REFERENCES targets(id) ON DELETE CASCADE
  );

  CREATE TABLE run_profile_tracks (
    id TEXT PRIMARY KEY,
    run_profile_id TEXT REFERENCES run_profiles(id) ON DELETE CASCADE
  );

  CREATE TABLE list_targets (
    list_id TEXT,
    target_id TEXT REFERENCES targets(id) ON DELETE CASCADE
  );

  CREATE TABLE todos (
    id TEXT PRIMARY KEY,
    target_id TEXT REFERENCES targets(id) ON DELETE CASCADE
  );

  CREATE TABLE activity_logs (
    id TEXT PRIMARY KEY,
    target_id TEXT REFERENCES targets(id) ON DELETE CASCADE
  );

  CREATE TABLE logs (
    id TEXT PRIMARY KEY,
    target_id TEXT REFERENCES targets(id) ON DELETE CASCADE
  );

  CREATE TABLE email_replies (
    id TEXT PRIMARY KEY,
    target_id TEXT REFERENCES targets(id) ON DELETE CASCADE,
    run_id TEXT REFERENCES runs(id) ON DELETE SET NULL
  );

  CREATE TABLE agent_sessions (
    id TEXT PRIMARY KEY,
    target_id TEXT REFERENCES targets(id) ON DELETE CASCADE,
    run_id TEXT REFERENCES runs(id) ON DELETE SET NULL
  );
`);

// Insert mock data
db.exec("INSERT INTO targets (id) VALUES ('t1'), ('t2')");
db.exec("INSERT INTO runs (id) VALUES ('r1')");

db.exec("INSERT INTO run_profiles (id, run_id, target_id) VALUES ('rp1', 'r1', 't1'), ('rp2', 'r1', 't2')");
db.exec("INSERT INTO run_profile_tracks (id, run_profile_id) VALUES ('rpt1', 'rp1'), ('rpt2', 'rp2')");
db.exec("INSERT INTO list_targets (list_id, target_id) VALUES ('l1', 't1'), ('l1', 't2')");
db.exec("INSERT INTO todos (id, target_id) VALUES ('td1', 't1'), ('td2', 't2')");
db.exec("INSERT INTO activity_logs (id, target_id) VALUES ('al1', 't1'), ('al2', 't2')");
db.exec("INSERT INTO logs (id, target_id) VALUES ('log1', 't1'), ('log2', 't2')");
db.exec("INSERT INTO email_replies (id, target_id, run_id) VALUES ('er1', 't1', 'r1'), ('er2', 't2', 'r1')");
db.exec("INSERT INTO agent_sessions (id, target_id, run_id) VALUES ('as1', 't1', 'r1'), ('as2', 't2', 'r1')");

// Perform deletion inside transaction
db.transaction(() => {
  db.prepare("DELETE FROM targets WHERE id = ?").run('t1');
})();

// Assertions for T1 (should be deleted)
assert.strictEqual(db.prepare("SELECT COUNT(*) as c FROM targets WHERE id = 't1'").get().c, 0, "target t1 not deleted");
assert.strictEqual(db.prepare("SELECT COUNT(*) as c FROM run_profiles WHERE target_id = 't1'").get().c, 0, "run_profiles not deleted");
assert.strictEqual(db.prepare("SELECT COUNT(*) as c FROM run_profile_tracks WHERE id = 'rpt1'").get().c, 0, "run_profile_tracks not deleted");
assert.strictEqual(db.prepare("SELECT COUNT(*) as c FROM list_targets WHERE target_id = 't1'").get().c, 0, "list_targets not deleted");
assert.strictEqual(db.prepare("SELECT COUNT(*) as c FROM todos WHERE target_id = 't1'").get().c, 0, "todos not deleted");
assert.strictEqual(db.prepare("SELECT COUNT(*) as c FROM activity_logs WHERE target_id = 't1'").get().c, 0, "activity_logs not deleted");
assert.strictEqual(db.prepare("SELECT COUNT(*) as c FROM logs WHERE target_id = 't1'").get().c, 0, "logs not deleted");
assert.strictEqual(db.prepare("SELECT COUNT(*) as c FROM email_replies WHERE target_id = 't1'").get().c, 0, "email_replies not deleted");
assert.strictEqual(db.prepare("SELECT COUNT(*) as c FROM agent_sessions WHERE target_id = 't1'").get().c, 0, "agent_sessions not deleted");

// Assertions for T2 (should be preserved)
assert.strictEqual(db.prepare("SELECT COUNT(*) as c FROM targets WHERE id = 't2'").get().c, 1, "target t2 deleted");
assert.strictEqual(db.prepare("SELECT COUNT(*) as c FROM run_profiles WHERE target_id = 't2'").get().c, 1, "run_profiles for t2 deleted");
assert.strictEqual(db.prepare("SELECT COUNT(*) as c FROM run_profile_tracks WHERE id = 'rpt2'").get().c, 1, "run_profile_tracks for t2 deleted");

// Assertions for Run (should be preserved)
assert.strictEqual(db.prepare("SELECT COUNT(*) as c FROM runs WHERE id = 'r1'").get().c, 1, "runs deleted");

console.log("✅ Regression tests passed!");
