const fs = require('fs');
let code = fs.readFileSync('lib/db.ts', 'utf8');

// I will remove the manual 'Migrate workflow_steps CHECK constraint' blocks entirely,
// because checking sqlite_master and doing a table recreate with hardcoded columns is a recipe for data loss!
// Wait, if I remove them, how will new step types be allowed?
// By dropping the check constraint! Or by doing a dynamic recreate!
// Let's replace the hardcoded recreate with a regex-based column extractor, or just drop the check constraint requirement (since application logic enforces it).
// Actually, I can just replace the whole recreate block with nothing! We don't NEED the check constraint at the DB level if TypeScript enforces it, but to be safe, I'll dynamically fetch columns.

// Wait, the easiest way is to just find the try { ... } catch {} block that recreates the table and replace it with a robust version that gets columns dynamically.
const robustRecreate = `
  // Safely migrate workflow_steps CHECK constraint
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='workflow_steps'").get() as { sql: string } | undefined;
    if (tableInfo && !tableInfo.sql.includes("'integration'")) {
      db.exec("PRAGMA foreign_keys = OFF;");
      
      const columnsQuery = db.prepare("PRAGMA table_info(workflow_steps)").all() as any[];
      const colNames = columnsQuery.map(c => c.name);
      
      // We will recreate it dynamically
      let createSql = \`CREATE TABLE workflow_steps_new (
        id TEXT PRIMARY KEY,
        workflow_id TEXT REFERENCES workflows(id) ON DELETE CASCADE,
        step_order INTEGER NOT NULL,
        step_type TEXT NOT NULL CHECK(step_type IN ('visit', 'connect', 'message', 'sales_inmail', 'delay', 'email', 'integration')),
        template_id TEXT REFERENCES templates(id)\`;
        
      for (const col of columnsQuery) {
        if (!['id', 'workflow_id', 'step_order', 'step_type', 'template_id'].includes(col.name)) {
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
  } catch (err) { console.error("Migration error:", err); }
`;

// Replace the two occurrences of manual table recreation
// 1. The one I edited earlier:
code = code.replace(/\/\/ Migrate workflow_steps CHECK constraint to allow 'integration' step_type[\s\S]*?catch \{ \/\* migration already done \*\/ \}/, robustRecreate);

// 2. Are there other occurrences? Let's check:
fs.writeFileSync('lib/db.ts', code);
