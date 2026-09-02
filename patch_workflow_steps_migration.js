const fs = require('fs');

let code = fs.readFileSync('lib/db.ts', 'utf8');

const migrationBlock = `  // Safely migrate track CHECK constraint for workflow_steps
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='workflow_steps'").get() as { sql: string } | undefined;
    if (tableInfo && !tableInfo.sql.includes("'change_status'")) {
      db.exec("PRAGMA foreign_keys = OFF;");
      
      const columnsQuery = db.prepare("PRAGMA table_info(workflow_steps)").all() as any[];
      const colNames = columnsQuery.map(c => c.name);
      
      let createSql = \`CREATE TABLE workflow_steps_new (
      id TEXT PRIMARY KEY,
      workflow_id TEXT REFERENCES workflows(id) ON DELETE CASCADE,
      step_order INTEGER NOT NULL,
      step_type TEXT NOT NULL CHECK(step_type IN ('visit', 'connect', 'message', 'delay', 'email', 'sales_inmail', 'integration', 'change_status')),
      template_id TEXT REFERENCES templates(id),
      delay_seconds INTEGER DEFAULT 0,
      connect_note TEXT,
      message_body TEXT,
      enabled INTEGER DEFAULT 1,
      config TEXT\`;
      
      for (const col of columnsQuery) {
        if (!['id', 'workflow_id', 'step_order', 'step_type', 'template_id', 'delay_seconds', 'connect_note', 'message_body', 'enabled', 'config'].includes(col.name)) {
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
  } catch (err) { console.error("Migration error workflow_steps:", err); }
`;

code = code.replace(
  '  // Safely migrate track CHECK constraint for workflow_steps\n  try {',
  migrationBlock + '\n  try {'
);

code = code.replace(
  `step_type TEXT NOT NULL CHECK(step_type IN ('visit', 'connect', 'message', 'delay', 'email', 'sales_inmail', 'integration')),`,
  `step_type TEXT NOT NULL CHECK(step_type IN ('visit', 'connect', 'message', 'delay', 'email', 'sales_inmail', 'integration', 'change_status')),`
);

fs.writeFileSync('lib/db.ts', code);
