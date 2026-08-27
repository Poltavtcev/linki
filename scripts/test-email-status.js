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
      state TEXT,
      last_email_subject TEXT,
      last_email_body TEXT
    );
  `);

  const accountId = 'acc-1';

  // Target 1: status NULL (should be INCLUDED)
  db.prepare(`INSERT INTO targets (id, email, email_status) VALUES ('t1', 't1@example.com', NULL)`).run();
  
  // Target 2: status valid (should be INCLUDED)
  db.prepare(`INSERT INTO targets (id, email, email_status) VALUES ('t2', 't2@example.com', 'valid')`).run();
  
  // Target 3: status invalid (should be EXCLUDED)
  db.prepare(`INSERT INTO targets (id, email, email_status) VALUES ('t3', 't3@example.com', 'invalid')`).run();
  
  // Target 4: status NULL but replied (should be EXCLUDED)
  db.prepare(`INSERT INTO targets (id, email, email_replied_at, email_status) VALUES ('t4', 't4@example.com', '2023-01-01', NULL)`).run();

  // Target 5: email not sent yet (last_email_subject IS NULL) (should be EXCLUDED)
  db.prepare(`INSERT INTO targets (id, email, email_status) VALUES ('t5', 't5@example.com', NULL)`).run();
  
  // Target 6: email sent (should be INCLUDED)
  db.prepare(`INSERT INTO targets (id, email, email_status) VALUES ('t6', 't6@example.com', NULL)`).run();

  // Insert profiles and tracks
  for (let i = 1; i <= 6; i++) {
    const tId = 't' + i;
    const rpId = 'rp' + i;
    db.prepare(`INSERT INTO run_profiles (id, target_id, email_account_id) VALUES (?, ?, ?)`).run(rpId, tId, accountId);
    
    let subject = 'Subject';
    let body = 'Body';
    
    if (i === 5) {
      subject = null;
      body = null;
    }
    
    db.prepare(`INSERT INTO run_profile_tracks (id, run_profile_id, track, state, last_email_subject, last_email_body) VALUES (?, ?, 'email', 'in_progress', ?, ?)`).run('rt'+i, rpId, subject, body);
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
      AND (rt.last_email_subject IS NOT NULL OR rt.last_email_body IS NOT NULL)
      AND rp.email_account_id = ?
  `).all(accountId);

  const includedIds = pendingTargets.map(t => t.id).sort();
  console.log('Included Target IDs:', includedIds);

  try {
    assert.deepStrictEqual(includedIds, ['t1', 't2', 't6']);
    console.log('✅ Test passed: properly filtered by email sent marker and status.');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

runTest();
