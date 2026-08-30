const fs = require('fs');

let code = fs.readFileSync('lib/db.ts', 'utf8');

// 1. Initial schema creation fixes
code = code.replace(
  'target_id TEXT REFERENCES targets(id),',
  'target_id TEXT REFERENCES targets(id) ON DELETE CASCADE,'
);

// We need to replace ALL instances in the initial schema strings.
code = code.replace(
  /target_id TEXT REFERENCES targets\(id\),/g,
  'target_id TEXT REFERENCES targets(id) ON DELETE CASCADE,'
);

code = code.replace(
  /run_id TEXT,[\s\n]*target_id TEXT,[\s\n]*step_id TEXT,/g,
  'run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,\n      target_id TEXT REFERENCES targets(id) ON DELETE CASCADE,\n      step_id TEXT,'
);

// 2. Migration code to modify existing databases
const migrationCode = `
  // Migration: Add ON DELETE CASCADE to target references
  try {
    const tableInfo = db.prepare("PRAGMA foreign_key_list(run_profiles)").all();
    const hasCascade = tableInfo.some(fk => fk.table === 'targets' && fk.on_delete === 'CASCADE');
    if (!hasCascade) {
      db.exec(\`
        PRAGMA foreign_keys = OFF;
        
        CREATE TABLE run_profiles_new (
          id TEXT PRIMARY KEY,
          run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,
          target_id TEXT REFERENCES targets(id) ON DELETE CASCADE,
          email_account_id TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          UNIQUE(run_id, target_id)
        );
        INSERT INTO run_profiles_new (id, run_id, target_id, email_account_id, created_at)
          SELECT id, run_id, target_id, email_account_id, created_at FROM run_profiles;
        DROP TABLE run_profiles;
        ALTER TABLE run_profiles_new RENAME TO run_profiles;
        
        CREATE TABLE logs_new (
          id TEXT PRIMARY KEY,
          run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,
          target_id TEXT REFERENCES targets(id) ON DELETE CASCADE,
          level TEXT DEFAULT 'info' CHECK(level IN ('info', 'warn', 'error')),
          message TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO logs_new SELECT * FROM logs;
        DROP TABLE logs;
        ALTER TABLE logs_new RENAME TO logs;
        
        CREATE TABLE agent_sessions_new (
          id TEXT PRIMARY KEY,
          run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
          target_id TEXT REFERENCES targets(id) ON DELETE CASCADE,
          step_id TEXT,
          model TEXT,
          input_tokens INTEGER,
          output_tokens INTEGER,
          cost_usd REAL,
          prompt TEXT,
          generated_text TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
        INSERT INTO agent_sessions_new SELECT * FROM agent_sessions;
        DROP TABLE agent_sessions;
        ALTER TABLE agent_sessions_new RENAME TO agent_sessions;
        
        PRAGMA foreign_keys = ON;
      \`);
    }
  } catch (e) { console.error("Migration error (cascade):", e); }
`;

// Insert the new migration right before runMigrations ends, or at the end of runMigrations
// Let's insert it inside the `runMigrations` function right before the end
code = code.replace(
  'function runMigrations(db: Database.Database) {\n',
  'function runMigrations(db: Database.Database) {\n' + migrationCode
);

fs.writeFileSync('lib/db.ts', code);
