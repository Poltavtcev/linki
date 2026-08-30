const fs = require('fs');
let code = fs.readFileSync('lib/email/inbox.ts', 'utf8');

const oldCode = `          const replyId = randomUUID();
          db.prepare(
            \`INSERT INTO email_replies (id, target_id, run_id, message_id, in_reply_to, from_email, subject, body_text, received_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\`
          ).run(replyId, targetId, runId, messageId, inReplyTo, parsedFrom, subject, bodyText, receivedAt);
          resolve(replyId);
        } catch (err) {
          console.warn(\`[email-inbox] captureReplyBody parse/insert failed:\`, err);
          resolve(null);
        }`;

const newCode = `          const replyId = randomUUID();
          try {
            db.prepare(
              \`INSERT INTO email_replies (id, target_id, run_id, message_id, in_reply_to, from_email, subject, body_text, received_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\`
            ).run(replyId, targetId, runId, messageId, inReplyTo, parsedFrom, subject, bodyText, receivedAt);
            resolve(replyId);
          } catch (insertErr: any) {
            if (insertErr.message && insertErr.message.includes('UNIQUE constraint failed')) {
              // Concurrent process beat us to the INSERT. Safely resolve null to block duplicate AI classification.
              resolve(null);
              return;
            }
            throw insertErr;
          }
        } catch (err) {
          console.warn(\`[email-inbox] captureReplyBody parse/insert failed:\`, err);
          resolve(null);
        }`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('lib/email/inbox.ts', code);
