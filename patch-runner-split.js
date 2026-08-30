const fs = require('fs');
let content = fs.readFileSync('lib/linkedin/runner.ts', 'utf8');

// The block starts at:
//   // Inbox sync
//   for (const accountId of allAccountIds) {

const syncRegex = /  \/\/ Inbox sync\n  for \(const accountId of allAccountIds\) \{\n    const accounts = Array\.from\(accountLimitsMap\.values\(\)\);\n    const acct = accounts\.find\(a => a\.account_id === accountId\);\n    if \(\!acct\) continue;\n\n    const limits = acct;\n    const \{ hour, minute \} = getLocalParts\(limits\.timezone \|\| "UTC"\);\n    const nowFrac = hour \+ minute \/ 60;\n    const start = limits\.active_hours_start \?\? 9;\n    const end = limits\.active_hours_end \?\? 18;\n\n    const isActiveTime = nowFrac >= start && nowFrac < end;\n    const isWorkingDay = isAllowedDay\(limits\.working_days \?\? "Mon,Tue,Wed,Thu,Fri", limits\.timezone \|\| "UTC"\);\n\n    if \(\!isActiveTime \|\| \!isWorkingDay\) continue;\n\n    const lastSyncStr = db\.prepare\("SELECT last_sync_at FROM accounts WHERE id = \?"\)\.get\(accountId\) as \{ last_sync_at: string \| null \} \| undefined;\n    let isDue = true;\n    if \(lastSyncStr\?.last_sync_at\) \{\n      const minAgo = \(Date\.now\(\) - new Date\(lastSyncStr\.last_sync_at\)\.getTime\(\)\) \/ 60000;\n      if \(minAgo < 15\) isDue = false;\n    \}\n\n    if \(isDue && \!activeLinkedinSyncs\.has\(accountId\)\) \{\n      activeLinkedinSyncs\.add\(accountId\);\n      try \{\n        console\.log\(\`\[runner\] Starting LinkedIn inbox sync for account \$\{accountId\}\`\);\n        \n        const syncResult = await syncLinkedInInboxReadOnly\(\{ accountId, source: new LinkedInNetworkObserver\(\) \}\);\n        const replies = syncResult\.captured;\n\n        console\.log\(\`\[runner\] LinkedIn inbox sync complete — \$\{replies\} new repl\$\{replies === 1 \? "y" : "ies"\}\`\);\n        if \(replies > 0\) \{\n          for \(const r of activeRuns\.filter\(x => x\.account_id === accountId\)\) \{\n            ensureTracks\(db, r\.run_id, r\.workflow_id\);\n          \}\n        \}\n      \} catch \(err\) \{\n        console\.error\(\`\[runner\] LinkedIn inbox sync failed for \$\{accountId\}:\`, err instanceof Error \? err\.message : err\);\n      \} finally \{\n        activeLinkedinSyncs\.delete\(accountId\);\n      \}\n    \}\n  \}/;

let match = content.match(syncRegex);
if (!match) {
    console.log("Could not find sync block!");
} else {
    let syncBlock = match[0];
    
    // Remove the block from tick()
    content = content.replace(syncBlock, "");
    
    // Create tickSync function
    let tickSyncFunc = `async function tickSync(db: ReturnType<typeof getDb>): Promise<void> {
  const allAuthenticatedAccounts = db.prepare("SELECT id FROM accounts WHERE is_authenticated = 1").all() as { id: string }[];
  const allAccountIds = allAuthenticatedAccounts.map(a => a.id);
  
  const accountLimitsMap = new Map<string, AccountLimits>();
  for (const accountId of allAccountIds) {
    const limits = db.prepare(\`
      SELECT daily_connection_limit, daily_message_limit, daily_inmail_limit,
             active_hours_start, active_hours_end, timezone, working_days
      FROM accounts WHERE id = ?
    \`).get(accountId) as AccountLimits;
    if (limits) accountLimitsMap.set(accountId, limits);
  }

${syncBlock}
}
`;

    // Add tickSync before globalLoop
    content = content.replace(/async function globalLoop\(\): Promise<void> \{/, tickSyncFunc + "\nasync function globalLoop(): Promise<void> {");
    
    // Rename tickSync to tickSync inside globalLoop, keep tickActions as tick
    content = content.replace(/await tickActions\(db\);/g, "await tick(db);");
    
    fs.writeFileSync('lib/linkedin/runner.ts', content);
    console.log("Done");
}
