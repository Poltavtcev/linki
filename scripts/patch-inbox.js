const fs = require('fs');
let code = fs.readFileSync('lib/email/inbox.ts', 'utf8');

// 1. Change pendingTargets query to select rp.run_id
code = code.replace(
  /SELECT DISTINCT t\.id, t\.email, rt\.state, rt\.track, t\.email_replied_at, rt\.last_email_message_id/,
  'SELECT DISTINCT t.id, t.email, rt.state, rt.track, t.email_replied_at, rt.last_email_message_id, rp.run_id'
);
code = code.replace(
  /last_email_message_id: string \| null }\[\];/,
  'last_email_message_id: string | null, run_id: string }[];'
);

// 2. Change msgIdToTargetId to msgIdToContext
code = code.replace(
  /const msgIdToTargetId = new Map<string, string>\(\);/g,
  'const msgIdToContext = new Map<string, { targetId: string, runId: string }>();'
);
code = code.replace(
  /msgIdToTargetId\.set\(msgId, pt\.id\);/g,
  'msgIdToContext.set(msgId, { targetId: pt.id, runId: pt.run_id });'
);
code = code.replace(
  /msgIdToTargetId\.set\(msgId\.replace\(\/\^<\|>\$\/g, ''\), pt\.id\);/g,
  "msgIdToContext.set(msgId.replace(/^<|>$/g, ''), { targetId: pt.id, runId: pt.run_id });"
);

// 3. Update Priority 1 Matching
code = code.replace(
  /let targetId: string \| undefined;/g,
  'let targetId: string | undefined;\n                    let runId: string | null = null;'
);
code = code.replace(
  /if \(inReplyTo && msgIdToTargetId\.has\(inReplyTo\)\) \{\s*targetId = msgIdToTargetId\.get\(inReplyTo\);\s*\} else if \(inReplyTo && msgIdToTargetId\.has\(inReplyTo\.replace\(\/\^<\|>\$\/g, ''\)\)\) \{\s*targetId = msgIdToTargetId\.get\(inReplyTo\.replace\(\/\^<\|>\$\/g, ''\)\);\s*\}/g,
  `if (inReplyTo && msgIdToContext.has(inReplyTo)) {
                      const ctx = msgIdToContext.get(inReplyTo)!;
                      targetId = ctx.targetId; runId = ctx.runId;
                    } else if (inReplyTo && msgIdToContext.has(inReplyTo.replace(/^<|>$/g, ''))) {
                      const ctx = msgIdToContext.get(inReplyTo.replace(/^<|>$/g, ''))!;
                      targetId = ctx.targetId; runId = ctx.runId;
                    }`
);
code = code.replace(
  /if \(!targetId\) \{\s*for \(const ref of references\) \{\s*if \(msgIdToTargetId\.has\(ref\)\) \{\s*targetId = msgIdToTargetId\.get\(ref\);\s*break;\s*\} else if \(msgIdToTargetId\.has\(ref\.replace\(\/\^<\|>\$\/g, ''\)\)\) \{\s*targetId = msgIdToTargetId\.get\(ref\.replace\(\/\^<\|>\$\/g, ''\)\);\s*break;\s*\}\s*\}\s*\}/g,
  `if (!targetId) {
                      for (const ref of references) {
                        if (msgIdToContext.has(ref)) {
                          const ctx = msgIdToContext.get(ref)!;
                          targetId = ctx.targetId; runId = ctx.runId;
                          break;
                        } else if (msgIdToContext.has(ref.replace(/^<|>$/g, ''))) {
                          const ctx = msgIdToContext.get(ref.replace(/^<|>$/g, ''))!;
                          targetId = ctx.targetId; runId = ctx.runId;
                          break;
                        }
                      }
                    }`
);

// 4. Update Priority 2 log
code = code.replace(
  /\/\/ Priority 2: Correlation by FROM email\s*if \(!targetId && fromEmail\) \{\s*targetId = emailToTargetId\.get\(fromEmail\);\s*\}/g,
  `// Priority 2: Correlation by FROM email
                    if (!targetId && fromEmail) {
                      targetId = emailToTargetId.get(fromEmail);
                      if (targetId) console.log(\`[email-inbox] run_id unresolved for \${fromEmail} (matched via Priority 2)\`);
                    }`
);

// 5. Update captureReplyBody call
code = code.replace(
  /const replyId = await captureReplyBody\(imap, db, targetId, fromEmail, msg\.uid\);/g,
  'const replyId = await captureReplyBody(imap, db, targetId, runId, fromEmail, msg.uid);'
);

// 6. Update captureReplyBody signature
code = code.replace(
  /export function captureReplyBody\(\s*imap: Imap,\s*db: ReturnType<typeof getDb>,\s*targetId: string,\s*fromEmail: string,\s*uid: number,\s*\): Promise<string \| null> \{/g,
  `export function captureReplyBody(
  imap: Imap,
  db: ReturnType<typeof getDb>,
  targetId: string,
  runId: string | null,
  fromEmail: string,
  uid: number,
): Promise<string | null> {`
);

// 7. Extract messageId and inReplyTo inside captureReplyBody
code = code.replace(
  /const receivedAt = parsed\.date \? parsed\.date\.toISOString\(\) : new Date\(\)\.toISOString\(\);/,
  `const receivedAt = parsed.date ? parsed.date.toISOString() : new Date().toISOString();
          const messageId = parsed.messageId ?? null;
          const inReplyTo = parsed.inReplyTo ?? null;`
);

// 8. Fix idempotency check and remove arbitrary run_id fallback
code = code.replace(
  /const existing = db\.prepare\(\s*\`SELECT id FROM email_replies WHERE target_id = \? AND received_at = \?\`\s*\)\.get\(targetId, receivedAt\) as \{ id: string \} \| undefined;\s*if \(existing\) \{ resolve\(null\); return; \}\s*\/\/ Look up the most recent active run for this target — the dispatcher needs\s*\/\/ it to find the email track to reschedule \/ enroll a substitute into\.\s*const runRow = db\.prepare\(\s*\`SELECT r\.id FROM runs r\s*JOIN run_profiles rp ON rp\.run_id = r\.id\s*WHERE rp\.target_id = \? AND r\.status IN \('running', 'paused'\)\s*ORDER BY r\.created_at DESC LIMIT 1\`\s*\)\.get\(targetId\) as \{ id: string \} \| undefined;\s*const replyId = randomUUID\(\);\s*db\.prepare\(\s*\`INSERT INTO email_replies \(id, target_id, run_id, from_email, subject, body_text, received_at\)\s*VALUES \(\?, \?, \?, \?, \?, \?, \?\)\`\s*\)\.run\(replyId, targetId, runRow\?\.id \?\? null, parsedFrom, subject, bodyText, receivedAt\);/g,
  `let existing;
          if (messageId) {
            existing = db.prepare(\`SELECT id FROM email_replies WHERE target_id = ? AND message_id = ?\`).get(targetId, messageId);
          }
          if (!existing) {
            existing = db.prepare(\`SELECT id FROM email_replies WHERE target_id = ? AND received_at = ?\`).get(targetId, receivedAt);
          }
          if (existing) { resolve(null); return; }

          const replyId = randomUUID();
          db.prepare(
            \`INSERT INTO email_replies (id, target_id, run_id, message_id, in_reply_to, from_email, subject, body_text, received_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\`
          ).run(replyId, targetId, runId, messageId, inReplyTo, parsedFrom, subject, bodyText, receivedAt);`
);

fs.writeFileSync('lib/email/inbox.ts', code);
