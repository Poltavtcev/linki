const fs = require('fs');
let code = fs.readFileSync('lib/db.ts', 'utf8');

const initialTable = `
    // Reply classifier: captured email replies + classifier verdict + dispatcher result
    \`CREATE TABLE IF NOT EXISTS email_replies (
      id TEXT PRIMARY KEY,
      target_id TEXT NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
      run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
      message_id TEXT,
      in_reply_to TEXT,
      from_email TEXT NOT NULL,
      subject TEXT,
      body_text TEXT NOT NULL,
      received_at TEXT NOT NULL,
      classified_at TEXT,
      classification_json TEXT,
      classification_error TEXT,
      dispatched_at TEXT,
      dispatch_result_json TEXT,
      manually_edited INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )\`,
`;

// Replace the initial table creation
code = code.replace(
  /\/\/ Reply classifier: captured email replies \+ classifier verdict \+ dispatcher result\s*\n\s*\`CREATE TABLE IF NOT EXISTS email_replies \([\s\S]*?created_at TEXT NOT NULL DEFAULT \(datetime\('now'\)\)\s*\n\s*\)\`,/,
  initialTable.trim()
);

// Add the migration block right before PRAGMA foreign_keys = ON; in runMigrations
const migrationBlock = `
        CREATE TABLE email_replies_new (
          id TEXT PRIMARY KEY,
          target_id TEXT NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
          run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
          message_id TEXT,
          in_reply_to TEXT,
          from_email TEXT NOT NULL,
          subject TEXT,
          body_text TEXT NOT NULL,
          received_at TEXT NOT NULL,
          classified_at TEXT,
          classification_json TEXT,
          classification_error TEXT,
          dispatched_at TEXT,
          dispatch_result_json TEXT,
          manually_edited INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        INSERT INTO email_replies_new (
          id, target_id, run_id, message_id, in_reply_to, from_email, subject, body_text,
          received_at, classified_at, classification_json, classification_error,
          dispatched_at, dispatch_result_json, manually_edited, created_at
        )
        SELECT 
          id, target_id, run_id, NULL as message_id, NULL as in_reply_to, from_email, subject, body_text,
          received_at, classified_at, classification_json, classification_error,
          dispatched_at, dispatch_result_json, manually_edited, created_at
        FROM email_replies;
        DROP TABLE email_replies;
        ALTER TABLE email_replies_new RENAME TO email_replies;
`;

code = code.replace(
  /ALTER TABLE agent_sessions_new RENAME TO agent_sessions;/,
  `ALTER TABLE agent_sessions_new RENAME TO agent_sessions;\n${migrationBlock}`
);

fs.writeFileSync('lib/db.ts', code);
