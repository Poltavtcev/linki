const Database = require('better-sqlite3');
const assert = require('assert');

function runTest() {
  const db = new Database(':memory:');

  // Setup schema
  db.exec(`
    CREATE TABLE targets (
      id TEXT PRIMARY KEY,
      email TEXT,
      email_replied_at TEXT,
      email_status TEXT
    );
    CREATE TABLE run_profiles (
      id TEXT PRIMARY KEY,
      target_id TEXT,
      email_account_id TEXT
    );
    CREATE TABLE run_profile_tracks (
      id TEXT PRIMARY KEY,
      run_profile_id TEXT,
      track TEXT,
      state TEXT
    );
  `);

  const accountId = 'acc-1';

  // Insert targets
  // Target 1: email_status is NULL (should be included)
  db.prepare(`INSERT INTO targets (id, email, email_replied_at, email_status) VALUES ('t1', 't1@example.com', NULL, NULL)`).run();
  
  // Target 2: email_status is 'valid' (should be included)
  db.prepare(`INSERT INTO targets (id, email, email_replied_at, email_status) VALUES ('t2', 't2@example.com', NULL, 'valid')`).run();
  
  // Target 3: email_status is 'invalid' (should be EXCLUDED)
  db.prepare(`INSERT INTO targets (id, email, email_replied_at, email_status) VALUES ('t3', 't3@example.com', NULL, 'invalid')`).run();
  
  // Target 4: email_status is NULL but replied_at is set (should be EXCLUDED)
  db.prepare(`INSERT INTO targets (id, email, email_replied_at, email_status) VALUES ('t4', 't4@example.com', '2023-01-01', NULL)`).run();

  // Insert profiles and tracks
  for (let i = 1; i <= 4; i++) {
    const tId = 't' + i;
    const rpId = 'rp' + i;
    db.prepare(`INSERT INTO run_profiles (id, target_id, email_account_id) VALUES (?, ?, ?)`).run(rpId, tId, accountId);
    db.prepare(`INSERT INTO run_profile_tracks (id, run_profile_id, track, state) VALUES (?, ?, 'email', 'in_progress')`).run('rt'+i, rpId);
  }

  // Run the exact query from inbox.ts
  const pendingTargets = db.prepare(`
    SELECT DISTINCT t.id, t.email, rt.state, rt.track, t.email_replied_at
    FROM targets t
    JOIN run_profiles rp ON rp.target_id = t.id
    JOIN run_profile_tracks rt ON rt.run_profile_id = rp.id
    WHERE t.email IS NOT NULL
      AND t.email_replied_at IS NULL
      AND (t.email_status IS NULL OR t.email_status != 'invalid')
      AND rt.track = 'email'
      AND rt.state NOT IN ('pending')
      AND rp.email_account_id = ?
  `).all(accountId);

  const includedIds = pendingTargets.map(t => t.id).sort();
  
  console.log('Included Target IDs:', includedIds);

  try {
    assert.deepStrictEqual(includedIds, ['t1', 't2']);
    console.log('✅ Test passed: NULL and non-invalid statuses are included; invalid and replied are excluded.');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

runTest();
