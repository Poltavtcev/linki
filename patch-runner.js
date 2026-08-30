const fs = require('fs');
let content = fs.readFileSync('lib/linkedin/runner.ts', 'utf8');

// Replace globalLoop to spawn separate loops
content = content.replace(
  /async function globalLoop\(\): Promise<void> \{\n  console\.log\("\[runner\] Global loop started"\);\n  const db = getDb\(\);\n\n  while \(true\) \{\n    try \{\n      await tick\(db\);\n    \} catch \(err\) \{\n      console\.error\("\[runner\] Tick error:", err instanceof Error \? err\.message : err\);\n    \}\n    try \{\n      const \{ processScheduledImports \} = await import\("@\/lib\/import-jobs"\);\n      await processScheduledImports\(db\);\n    \} catch \(err\) \{\n      console\.error\("\[runner\] Import scheduler error:", err instanceof Error \? err\.message : err\);\n    \}\n    await sleep\(POLL_INTERVAL_MS\);\n  \}\n\}/,
  `async function globalLoop(): Promise<void> {
  console.log("[runner] Global loops started");
  const db = getDb();

  const syncLoop = async () => {
    while (true) {
      try {
        await tickSync(db);
      } catch (err) {
        console.error("[runner] Sync tick error:", err instanceof Error ? err.message : err);
      }
      await sleep(15 * 60 * 1000); // Inbox sync every 15 mins
    }
  };

  const actionLoop = async () => {
    while (true) {
      try {
        await tickActions(db);
      } catch (err) {
        console.error("[runner] Action tick error:", err instanceof Error ? err.message : err);
      }
      try {
        const { processScheduledImports } = await import("@/lib/import-jobs");
        await processScheduledImports(db);
      } catch (err) {
        console.error("[runner] Import scheduler error:", err instanceof Error ? err.message : err);
      }
      await sleep(POLL_INTERVAL_MS);
    }
  };

  Promise.all([syncLoop(), actionLoop()]).catch(e => console.error(e));
}`
);

fs.writeFileSync('lib/linkedin/runner.ts', content);
