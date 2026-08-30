const fs = require('fs');
let code = fs.readFileSync('lib/email/inbox.ts', 'utf8');

const oldCode = `          const existing = db.prepare(
            "SELECT id FROM email_replies WHERE target_id = ? AND received_at = ?"
          ).get(targetId, receivedAt) as { id: string } | undefined;

          if (existing) { resolve(null); return; }

          // Look up the most recent active run for this target — the dispatcher needs
          // it to find the email track to reschedule / enroll a substitute into.
          const runRow = db.prepare(
            \`SELECT r.id FROM runs r
             JOIN run_profiles rp ON rp.run_id = r.id
             WHERE rp.target_id = ? AND r.status IN ('running', 'paused')
             ORDER BY r.created_at DESC LIMIT 1\`
          ).get(targetId) as { id: string } | undefined;

          const replyId = randomUUID();
          db.prepare(
            \`INSERT INTO email_replies (id, target_id, run_id, from_email, subject, body_text, received_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)\`
          ).run(replyId, targetId, runRow?.id ?? null, parsedFrom, subject, bodyText, receivedAt);`;

const newCode = `          let existing;
          if (messageId) {
            existing = db.prepare("SELECT id FROM email_replies WHERE target_id = ? AND message_id = ?").get(targetId, messageId);
          }
          if (!existing) {
            existing = db.prepare("SELECT id FROM email_replies WHERE target_id = ? AND received_at = ?").get(targetId, receivedAt);
          }
          if (existing) { resolve(null); return; }

          const replyId = randomUUID();
          db.prepare(
            \`INSERT INTO email_replies (id, target_id, run_id, message_id, in_reply_to, from_email, subject, body_text, received_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\`
          ).run(replyId, targetId, runId, messageId, inReplyTo, parsedFrom, subject, bodyText, receivedAt);`;

code = code.replace(oldCode, newCode);

fs.writeFileSync('lib/email/inbox.ts', code);
