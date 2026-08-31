const Database = require('better-sqlite3');
const db = new Database('linki.db');

const addCol = (sql) => {
  try { db.exec(sql); } catch(e) { console.log(e.message); }
};

addCol("ALTER TABLE workflow_steps ADD COLUMN track TEXT NOT NULL DEFAULT 'linkedin' CHECK(track IN ('linkedin', 'email'))");
addCol("ALTER TABLE workflow_steps ADD COLUMN ai_enabled INTEGER DEFAULT 0");
addCol("ALTER TABLE workflow_steps ADD COLUMN ai_model TEXT");
addCol("ALTER TABLE workflow_steps ADD COLUMN ai_prompt TEXT");
addCol("ALTER TABLE workflow_steps ADD COLUMN ai_max_words INTEGER");
addCol("ALTER TABLE workflow_steps ADD COLUMN email_position INTEGER DEFAULT 1");
addCol("ALTER TABLE workflow_steps ADD COLUMN message_position INTEGER DEFAULT 1");
addCol("ALTER TABLE workflow_steps ADD COLUMN ai_language TEXT DEFAULT 'English'");
addCol("ALTER TABLE workflow_steps ADD COLUMN email_signature TEXT");
addCol("ALTER TABLE workflow_steps ADD COLUMN config TEXT");

console.log("Columns restored");
