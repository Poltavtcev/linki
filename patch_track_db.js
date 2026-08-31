const fs = require('fs');
let code = fs.readFileSync('lib/db.ts', 'utf8');

const trackMigration = `
  // Safely migrate track CHECK constraint for run_profile_tracks
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='run_profile_tracks'").get() as { sql: string } | undefined;
    if (tableInfo && !tableInfo.sql.includes("'integration'")) {
      db.exec("PRAGMA foreign_keys = OFF;");
      
      const columnsQuery = db.prepare("PRAGMA table_info(run_profile_tracks)").all() as any[];
      const colNames = columnsQuery.map(c => c.name);
      
      let createSql = \`CREATE TABLE run_profile_tracks_new (
      id TEXT PRIMARY KEY,
      run_profile_id TEXT NOT NULL REFERENCES run_profiles(id) ON DELETE CASCADE,
      track TEXT NOT NULL CHECK(track IN ('linkedin', 'email', 'integration')),
      state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),
      current_step INTEGER NOT NULL DEFAULT 0,
      last_step_at TEXT,
      next_step_at TEXT,
      error_message TEXT,
      last_email_subject TEXT,
      last_email_body TEXT\`;
      
      for (const col of columnsQuery) {
        if (!['id', 'run_profile_id', 'track', 'state', 'current_step', 'last_step_at', 'next_step_at', 'error_message', 'last_email_subject', 'last_email_body'].includes(col.name)) {
          createSql += \`, \${col.name} \${col.type}\`;
        }
      }
      createSql += ");";
      
      db.exec(createSql);
      
      const colList = colNames.join(', ');
      db.exec(\`INSERT INTO run_profile_tracks_new (\${colList}) SELECT \${colList} FROM run_profile_tracks;\`);
      db.exec("DROP TABLE run_profile_tracks;");
      db.exec("ALTER TABLE run_profile_tracks_new RENAME TO run_profile_tracks;");
      db.exec("PRAGMA foreign_keys = ON;");
    }
  } catch (err) { console.error("Migration error run_profile_tracks:", err); }

  // Safely migrate track CHECK constraint for workflow_steps
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='workflow_steps'").get() as { sql: string } | undefined;
    if (tableInfo && !tableInfo.sql.includes("'integration'", tableInfo.sql.indexOf("CHECK(track IN"))) {
      db.exec("PRAGMA foreign_keys = OFF;");
      
      const columnsQuery = db.prepare("PRAGMA table_info(workflow_steps)").all() as any[];
      const colNames = columnsQuery.map(c => c.name);
      
      let createSql = \`CREATE TABLE workflow_steps_new (
        id TEXT PRIMARY KEY,
        workflow_id TEXT REFERENCES workflows(id) ON DELETE CASCADE,
        step_order INTEGER NOT NULL,
        step_type TEXT NOT NULL CHECK(step_type IN ('visit', 'connect', 'message', 'sales_inmail', 'delay', 'email', 'integration')),
        template_id TEXT REFERENCES templates(id),
        track TEXT NOT NULL DEFAULT 'linkedin' CHECK(track IN ('linkedin', 'email', 'integration'))\`;
        
      for (const col of columnsQuery) {
        if (!['id', 'workflow_id', 'step_order', 'step_type', 'template_id', 'track'].includes(col.name)) {
          createSql += \`, \${col.name} \${col.type}\`;
        }
      }
      createSql += ");";
      
      db.exec(createSql);
      
      const colList = colNames.join(', ');
      db.exec(\`INSERT INTO workflow_steps_new (\${colList}) SELECT \${colList} FROM workflow_steps;\`);
      db.exec("DROP TABLE workflow_steps;");
      db.exec("ALTER TABLE workflow_steps_new RENAME TO workflow_steps;");
      db.exec("PRAGMA foreign_keys = ON;");
    }
  } catch (err) { console.error("Migration error workflow_steps track:", err); }
`;

// Insert the migration logic right before `// CSV import:`
code = code.replace(/\/\/ CSV import:/, trackMigration + '\n  // CSV import:');

// Also update initial initDb statements
code = code.replace(/track TEXT NOT NULL CHECK\(track IN \('linkedin', 'email'\)\),/g, "track TEXT NOT NULL CHECK(track IN ('linkedin', 'email', 'integration')),");

fs.writeFileSync('lib/db.ts', code);
