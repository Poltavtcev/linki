const fs = require('fs');
let content = fs.readFileSync('lib/db.ts', 'utf8');

// 1. Add migration for 'config' column
const newMigrations = `"ALTER TABLE workflow_steps ADD COLUMN config TEXT",\n`;
content = content.replace(/const migrations = \[/, 'const migrations = [\n    ' + newMigrations);

// 2. Update initDb to include config and 'integration'
content = content.replace(/step_type TEXT NOT NULL CHECK\(step_type IN \('visit', 'connect', 'message', 'delay'\)\),/g, "step_type TEXT NOT NULL CHECK(step_type IN ('visit', 'connect', 'message', 'delay', 'email', 'sales_inmail', 'integration')),");
content = content.replace(/message_body TEXT,\n      enabled INTEGER DEFAULT 1\n    \);/, "message_body TEXT,\n      enabled INTEGER DEFAULT 1,\n      config TEXT\n    );");

// 3. Update the table recreate logic for step_type CHECK constraint
const oldRecreate = `// Migrate workflow_steps CHECK constraint to allow 'delay' and 'email' step_types
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='workflow_steps'").get() as { sql: string } | undefined;
    if (tableInfo && (!tableInfo.sql.includes("'delay'") || !tableInfo.sql.includes("'email'"))) {
      db.exec(\`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE workflow_steps_new (
          id TEXT PRIMARY KEY,
          workflow_id TEXT REFERENCES workflows(id) ON DELETE CASCADE,
          step_order INTEGER NOT NULL,
          step_type TEXT NOT NULL CHECK(step_type IN ('visit', 'connect', 'message', 'delay', 'email', 'sales_inmail')),`;

const newRecreate = `// Migrate workflow_steps CHECK constraint to allow 'delay', 'email', and 'integration' step_types
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='workflow_steps'").get() as { sql: string } | undefined;
    if (tableInfo && (!tableInfo.sql.includes("'integration'"))) {
      db.exec(\`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE workflow_steps_new (
          id TEXT PRIMARY KEY,
          workflow_id TEXT REFERENCES workflows(id) ON DELETE CASCADE,
          step_order INTEGER NOT NULL,
          step_type TEXT NOT NULL CHECK(step_type IN ('visit', 'connect', 'message', 'delay', 'email', 'sales_inmail', 'integration')),`;

content = content.replace(oldRecreate, newRecreate);

fs.writeFileSync('lib/db.ts', content);
