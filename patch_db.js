const fs = require('fs');
let content = fs.readFileSync('lib/db.ts', 'utf8');

const tableSql = `    \`CREATE TABLE IF NOT EXISTS linkedin_reply_queue (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
      thread_id TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    )\`,
`;

content = content.replace(/const migrations = \[/g, 'const migrations = [\n' + tableSql);

fs.writeFileSync('lib/db.ts', content);
