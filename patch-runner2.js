const fs = require('fs');
let content = fs.readFileSync('lib/linkedin/runner.ts', 'utf8');

// Rename tick to tickSync, and only keep sync logic
content = content.replace(
  /async function tick\(db: ReturnType<typeof getDb>\): Promise<void> \{/,
  `async function tickSync(db: ReturnType<typeof getDb>): Promise<void> {`
);

// We need to find the split point where action logic starts
content = content.replace(
  /  \/\/ Execution pass\n  const toExecute = \[\];/,
  `}\n\nasync function tickActions(db: ReturnType<typeof getDb>): Promise<void> {\n  const activeRuns = db.prepare(\`\n    SELECT r.id as run_id, r.workflow_id, r.account_id, r.email_account_id,\n           a.daily_connection_limit, a.daily_message_limit, a.daily_inmail_limit,\n           a.active_hours_start, a.active_hours_end, a.timezone, a.working_days\n    FROM runs r\n    JOIN accounts a ON a.id = r.account_id\n    WHERE r.status = 'running' AND a.is_authenticated = 1\n  \`).all() as Array<{ run_id: string; workflow_id: string; account_id: string; email_account_id: string | null } & AccountLimits>;\n\n  // Execution pass\n  const toExecute = [];`
);

fs.writeFileSync('lib/linkedin/runner.ts', content);
