const fs = require('fs');
let code = fs.readFileSync('pages/api/inbox/thread.ts', 'utf8');

// 1. Pass knownMessageIds and ownerEmail
code = code.replace(
  /const messages = await fetchThread\(\s*\{ host: account\.imap_host, port: account\.imap_port \?\? 993, user: imapUser, password: imapPass \},\s*targetEmail\s*\);/,
  `
    const knownIdsRows = db.prepare(\`
      SELECT last_email_message_id AS msg_id FROM run_profile_tracks rt
      JOIN run_profiles rp ON rp.id = rt.run_profile_id
      WHERE rp.target_id = ? AND rt.last_email_message_id IS NOT NULL
      UNION
      SELECT message_id AS msg_id FROM email_replies WHERE target_id = ? AND message_id IS NOT NULL
    \`).all(targetId, targetId) as { msg_id: string }[];
    const knownMessageIds = new Set(knownIdsRows.map(r => r.msg_id.trim().replace(/^<|>$/g, '')));
    const ownerEmail = account.username.toLowerCase();

    const messages = await fetchThread(
      { host: account.imap_host, port: account.imap_port ?? 993, user: imapUser, password: imapPass },
      targetEmail,
      ownerEmail,
      knownMessageIds
    );`
);

// 2. Change fetchThread signature
code = code.replace(
  /async function fetchThread\(cfg: ImapConfig, contactEmail: string\): Promise<EmailMessage\[\]> \{/,
  `async function fetchThread(cfg: ImapConfig, contactEmail: string, ownerEmail: string, knownMessageIds: Set<string>): Promise<EmailMessage[]> {`
);

// 3. Update the sorting and filtering
code = code.replace(
  /messages\.sort\(\(a, b\) => a\.date\.localeCompare\(b\.date\)\);\s*resolve\(messages\);\s*done\(\);/g,
  `
            // Build thread graph to filter out irrelevant emails (Bug B fix)
            const isSelfTest = contactEmail === ownerEmail;
            let finalMessages = messages;

            if (isSelfTest) {
              const connected = new Set<string>();
              for (const id of knownMessageIds) connected.add(id);
              
              let changed = true;
              while (changed) {
                changed = false;
                for (const m of messages) {
                  if (!m.messageId) continue;
                  const mId = m.messageId.replace(/^<|>$/g, '');
                  if (connected.has(mId)) continue;

                  let linked = false;
                  // Try to find if this message replies to a connected message
                  // We don't have parsed.inReplyTo in EmailMessage yet, so we'll need to parse it or just rely on the DB
                  // Actually, without parsing inReplyTo in fetchThread, we can't easily link.
                  // But since we just need a simple filter: if it's a self-test, ONLY include messages that match knownMessageIds!
                  if (knownMessageIds.has(mId)) {
                    connected.add(mId);
                    linked = true;
                    changed = true;
                  }
                }
              }
              finalMessages = messages.filter(m => m.messageId && connected.has(m.messageId.replace(/^<|>$/g, '')));
            }

            finalMessages.sort((a, b) => a.date.localeCompare(b.date));
            resolve(finalMessages);
            done();
`
);

// Oh wait, fetchThread's EmailMessage needs inReplyTo to build a proper graph if we want to support manual emails during self-tests.
// But the user just said: "Inbox має показувати тільки реальну переписку конкретного target... без Vercel, Instagram".
// The simplest, most bulletproof filter for the self-test case (where contactEmail === ownerEmail) is to ONLY include knownMessageIds!
// If it's a normal lead (contactEmail !== ownerEmail), we include ALL messages FROM/TO them, which is exactly the correct behavior for a CRM.
// Let's implement that.

fs.writeFileSync('pages/api/inbox/thread.ts', code);
