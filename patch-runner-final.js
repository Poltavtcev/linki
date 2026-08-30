const fs = require('fs');
let content = fs.readFileSync('lib/linkedin/runner.ts', 'utf8');

// Replace globalLoop entirely with the parallel loops.
content = content.replace(
  /async function globalLoop\(\): Promise<void> \{[\s\S]*?async function tick\(db: ReturnType<typeof getDb>\): Promise<void> \{/,
  `async function globalLoop(): Promise<void> {
  console.log("[runner] Global loop started");
  const db = getDb();

  // Run the inbox sync logic in a separate parallel loop so it's not starved by action delays
  const syncLoop = async () => {
    while (true) {
      try {
        await tickSync(db);
      } catch (err) {
        console.error("[runner] Sync tick error:", err instanceof Error ? err.message : err);
      }
      await sleep(5 * 60 * 1000); // 5 min
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
}

async function tickSync(db: ReturnType<typeof getDb>): Promise<void> {
  const activeRuns = db.prepare(\`
    SELECT r.id as run_id, r.workflow_id, r.account_id, r.email_account_id,
           a.daily_connection_limit, a.daily_message_limit, a.daily_inmail_limit,
           a.active_hours_start, a.active_hours_end, a.timezone, a.working_days
    FROM runs r
    JOIN accounts a ON a.id = r.account_id
    WHERE r.status = 'running' AND a.is_authenticated = 1
  \`).all() as Array<{ run_id: string; workflow_id: string; account_id: string; email_account_id: string | null } & AccountLimits>;

  const allAuthenticatedAccounts = db.prepare("SELECT id FROM accounts WHERE is_authenticated = 1").all() as { id: string }[];
  const allAccountIds = allAuthenticatedAccounts.map(a => a.id);

  for (const accountId of allAccountIds) {
    if (shouldSyncAccepted(accountId)) {
      try {
        const stamped = await syncAcceptedConnections(accountId);
      } catch (e) {
        console.warn("[runner] Accepted-connections sync error:", e instanceof Error ? e.message : e);
      }
    }
  }

  for (const accountId of allAccountIds) {
    const acc = db.prepare("SELECT is_authenticated FROM accounts WHERE id = ?").get(accountId) as { is_authenticated: number } | undefined;
    if (acc && acc.is_authenticated) {
      const lastSync = lastLinkedinSync.get(accountId) || 0;
      const dueAfterMs = IMAP_POLL_INTERVAL_MS + accountJitterMs(accountId);
      const isDue = Date.now() - lastSync >= dueAfterMs;

      if (isDue && !activeLinkedinSyncs.has(accountId)) {
        activeLinkedinSyncs.add(accountId);
        try {
          const syncResult = await syncLinkedInInboxReadOnly({ accountId, source: new LinkedInNetworkObserver() });
        } catch (e) {
          console.warn("[runner] LinkedIn inbox sync error:", e instanceof Error ? e.message : e);
        } finally {
          lastLinkedinSync.set(accountId, Date.now());
          activeLinkedinSyncs.delete(accountId);
        }
      }
    }
  }

  const activeRunIds = activeRuns.map(r => r.run_id);
  const activeEmailAccountIds: string[] = activeRunIds.length > 0
    ? [...new Set(
        (db.prepare(
          \`SELECT DISTINCT rp.email_account_id FROM run_profiles rp
           JOIN run_profile_tracks rt ON rt.run_profile_id = rp.id
           WHERE rp.run_id IN (\${activeRunIds.map(() => "?").join(",")})
           AND rp.email_account_id IS NOT NULL
           AND rt.state NOT IN ('completed', 'failed', 'skipped')\`
        ).all(...activeRunIds) as { email_account_id: string }[]).map(r => r.email_account_id)
      )]
    : [];

  const seenEmailAccounts = new Set<string>();
  for (const emailAccId of activeEmailAccountIds) {
    if (seenEmailAccounts.has(emailAccId)) continue;
    seenEmailAccounts.add(emailAccId);
    if (shouldSyncEmailInbox(emailAccId)) {
      try {
        await syncEmailInbox(emailAccId);
      } catch (e) {
        console.warn("[runner] Email inbox sync error:", e instanceof Error ? e.message : e);
      }
      await sleep(2000);
    }
  }
}

async function tickActions(db: ReturnType<typeof getDb>): Promise<void> {`
);

fs.writeFileSync('lib/linkedin/runner.ts', content);
