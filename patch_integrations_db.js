const fs = require('fs');
let content = fs.readFileSync('lib/db.ts', 'utf8');

// The migrations array handles schema updates
const newMigrations = `    "ALTER TABLE integrations ADD COLUMN is_active INTEGER DEFAULT 1",
    "ALTER TABLE integrations ADD COLUMN credits_remaining INTEGER",
    "ALTER TABLE integrations ADD COLUMN quota_resets_at TEXT",
`;

content = content.replace(/const migrations = \[/g, 'const migrations = [\n' + newMigrations);

// Ensure the CREATE TABLE statement in initDb has the new columns
const oldCreateTable = `      CREATE TABLE IF NOT EXISTS integrations (
        key TEXT PRIMARY KEY,
        api_key TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`;

const newCreateTable = `      CREATE TABLE IF NOT EXISTS integrations (
        key TEXT PRIMARY KEY,
        api_key TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        credits_remaining INTEGER,
        quota_resets_at TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`;

content = content.replace(oldCreateTable, newCreateTable);

fs.writeFileSync('lib/db.ts', content);
