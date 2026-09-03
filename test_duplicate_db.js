const Database = require('better-sqlite3');
const db = new Database('./lib/dyad.db'); // assume this is the path, or I'll find it

try {
  const steps = db.prepare("SELECT * FROM workflow_steps LIMIT 5").all();
  console.log(steps);
} catch (e) {
  console.log(e.message);
}
