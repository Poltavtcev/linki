const { getDb } = require('./lib/db.js');
const db = getDb();

// 1. Create a dummy workflow
db.exec("INSERT INTO workflows (id, name) VALUES ('test-wf-1', 'Test WF 1')");

// 2. Add an email track change_status step
db.exec("INSERT INTO workflow_steps (id, workflow_id, step_order, track, step_type, config) VALUES ('test-step-1', 'test-wf-1', 1, 'email', 'change_status', '{\"status_id\":\"customer\"}')");

console.log("Original step:");
console.log(db.prepare("SELECT * FROM workflow_steps WHERE workflow_id = 'test-wf-1'").get());

// 3. We can't easily call the API duplicate.ts, but we can look at the data.
