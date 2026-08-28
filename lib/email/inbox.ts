import Imap from "imap";
import { simpleParser } from "mailparser";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { premium } from "@/lib/premium";
import { decryptSecret } from "@/lib/crypto";

const IMAP_POLL_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
// Jul 2026 incident: all email accounts became "due" in the same tick and synced
// back-to-back (one 20-account burst ran 3 minutes straight, one account alone took
// 85s), which lined up with NocoDB/n8n healthcheck failures on the shared host. A
// deterministic per-account offset spreads accounts across a window so they drift
// apart over successive cycles instead of staying clustered together forever.
const IMAP_POLL_JITTER_MS = 30 * 60 * 1000; // 30 min

function accountJitterMs(accountId: string): number {
  let h = 0;
  for (let i = 0; i < accountId.length; i++) h = (h * 31 + accountId.charCodeAt(i)) >>> 0;
  return h % IMAP_POLL_JITTER_MS;
}

const BOUNCE_SENDER_PATTERNS = [
  /mailer-daemon@/i,
  /postmaster@/i,
  /mail-delivery-subsystem@/i,
  /delivery-status@/i,
  /amazonses\.com$/i,
];

function extractEmails(text: string): string[] {
  return [...text.matchAll(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g)].map(m => m[0].toLowerCase());
}

function isBounce(fromEmail: string): boolean {
  return BOUNCE_SENDER_PATTERNS.some(p => p.test(fromEmail));
}

function parseHeaderValue(raw: string, field: string): string {
  const regex = new RegExp(`^${field}:[ \\t]*(.+?)(?=\\r?\\n[^\\s]|$)`, "im");
  const m = raw.match(regex);
  if (!m) return "";
  return m[1].replace(/\r?\n[\t ]+/g, " ").trim();
}

interface EmailAccount {
  id: string;
  imap_host: string | null;
  imap_port: number | null;
  username: string;
  password: string;
  imap_username: string | null;
  imap_password: string | null;
  inbox_synced_at: string | null;
  inbox_last_uid: number | null;
  inbox_uidvalidity: number | null;
}

/**
 * Fetches the body + headers for a given UID and inserts a row into
 * `email_replies` (idempotent — skips if a row with the same target_id +
 * received_at already exists). Best-effort: errors are swallowed by the caller.
 */
export function captureReplyBody(
  imap: Imap,
  db: ReturnType<typeof getDb>,
  targetId: string,
  runId: string | null,
  fromEmail: string,
  uid: number,
): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    // Fetch the full raw RFC822 message — mailparser handles MIME multipart,
    // base64 / quoted-printable transfer encodings, and charset decoding. The
    // old HEADER+TEXT regex approach stored raw base64 / =XX escapes for the
    // common German auto-reply formats, feeding the classifier garbage.
    const fetch = imap.fetch(uid, { bodies: [""], struct: false });

    const chunks: Buffer[] = [];

    fetch.on("message", (msg) => {
      msg.on("body", (stream) => {
        stream.on("data", (c: Buffer) => chunks.push(c));
      });
    });

    fetch.once("error", () => resolve(null));
    fetch.once("end", () => {
      void (async () => {
        try {
          const raw = Buffer.concat(chunks);
          const parsed = await simpleParser(raw);

          const subject = parsed.subject ?? null;
          const parsedFrom =
            parsed.from?.value?.[0]?.address?.toLowerCase().trim() || fromEmail.toLowerCase();
          const receivedAt = parsed.date ? parsed.date.toISOString() : new Date().toISOString();
          const messageId = parsed.messageId ?? null;
          const inReplyTo = parsed.inReplyTo ?? null;

          // Prefer decoded plain text; fall back to stripping the HTML part.
          const rawText =
            parsed.text ??
            (parsed.html ? parsed.html.replace(/<[^>]+>/g, " ") : "");
          const bodyText = rawText
            .replace(/\r\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .replace(/[ \t]{2,}/g, " ")
            .trim()
            .slice(0, 16_000);

          if (!bodyText) { resolve(null); return; }

          // Dedup: skip if we already have a row for this target with the same received_at
          let existing;
          if (messageId) {
            existing = db.prepare("SELECT id FROM email_replies WHERE target_id = ? AND message_id = ?").get(targetId, messageId);
          }
          if (!existing) {
            existing = db.prepare("SELECT id FROM email_replies WHERE target_id = ? AND received_at = ?").get(targetId, receivedAt);
          }
          if (existing) { resolve(null); return; }

          const replyId = randomUUID();
          try {
            db.prepare(
              `INSERT INTO email_replies (id, target_id, run_id, message_id, in_reply_to, from_email, subject, body_text, received_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
          console.warn(`[email-inbox] captureReplyBody parse/insert failed:`, err);
          resolve(null);
        }
      })();
    });
  });
}

export function shouldSyncEmailInbox(emailAccountId: string): boolean {
  const db = getDb();
  const account = db
    .prepare("SELECT inbox_synced_at FROM email_accounts WHERE id = ?")
    .get(emailAccountId) as { inbox_synced_at: string | null } | undefined;
  if (!account?.inbox_synced_at) return true;
  const dueAfterMs = IMAP_POLL_INTERVAL_MS + accountJitterMs(emailAccountId);
  return Date.now() - new Date(account.inbox_synced_at).getTime() >= dueAfterMs;
}

/**
 * Opens one IMAP connection, then for each lead that has been emailed but
 * not yet replied, runs a server-side FROM search. Only touches the mailbox
 * index — never downloads message bodies for reply detection.
 *
 * Also scans the last 50 messages for bounces (mailer-daemon etc.).
 */
export async function syncEmailInbox(emailAccountId: string): Promise<{ replies: number; bounces: number }> {
  const db = getDb();

  const account = db
    .prepare("SELECT id, imap_host, imap_port, username, password, imap_username, imap_password, inbox_synced_at, inbox_last_uid, inbox_uidvalidity FROM email_accounts WHERE id = ?")
    .get(emailAccountId) as EmailAccount | undefined;


  if (!account?.imap_host) {
    console.warn(`[email-inbox] Account ${emailAccountId} has no IMAP config — skipping`);
    return { replies: 0, bounces: 0 };
  }

  // Leads that were emailed via this account and haven't replied yet
  const pendingTargets = db.prepare(`
    SELECT DISTINCT t.id, t.email, rt.state, rt.track, t.email_replied_at, rt.last_email_message_id, rp.run_id
    FROM targets t
    JOIN run_profiles rp ON rp.target_id = t.id
    JOIN run_profile_tracks rt ON rt.run_profile_id = rp.id
    WHERE t.email IS NOT NULL
      AND t.email_replied_at IS NULL
      AND (t.email_status IS NULL OR t.email_status != 'invalid')
      AND rt.track = 'email'
      AND rt.state NOT IN ('pending')
      AND (rt.last_email_subject IS NOT NULL OR rt.last_email_body IS NOT NULL)
      AND rp.email_account_id = ?
  `).all(emailAccountId) as { id: string; email: string; state: string; track: string; email_replied_at: string | null , last_email_message_id: string | null, run_id: string }[];


  if (pendingTargets.length === 0) {
    db.prepare("UPDATE email_accounts SET inbox_synced_at = datetime('now') WHERE id = ?").run(emailAccountId);
    return { replies: 0, bounces: 0 };
  }


  const imapUser = account.imap_username ?? account.username;
  const imapPass = decryptSecret(account.imap_password) ?? decryptSecret(account.password)!;

  let replies = 0;
  let bounces = 0;

  await new Promise<void>((resolve) => {
    const imap = new Imap({
      host: account.imap_host!,
      port: account.imap_port ?? 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      user: imapUser,
      password: imapPass,
      authTimeout: 10_000,
      connTimeout: 12_000,
    });

    const done = () => {
      try { imap.end(); } catch { /* ignore */ }
      resolve();
    };

    imap.once("error", (err: Error) => {
      console.warn(`[email-inbox] IMAP error for account ${emailAccountId}:`, err.message);
      done();
    });

    imap.once("ready", () => {
      imap.openBox("INBOX", true, async (err, box) => {
        if (err || !box) { console.warn("[email-inbox] openBox failed:", err?.message); done(); return; }
        
        
        
        // ── Incremental IMAP Reply Detection ──────────────────────────────
        const emailToTargetId = new Map<string, string>();
        const msgIdToContext = new Map<string, { targetId: string, runId: string }>();
        for (const pt of pendingTargets) {
          if (pt.email) {
            emailToTargetId.set(pt.email.trim().toLowerCase(), pt.id);
          }
          if (pt.last_email_message_id) {
            const msgId = pt.last_email_message_id.trim();
            msgIdToContext.set(msgId, { targetId: pt.id, runId: pt.run_id });
            msgIdToContext.set(msgId.replace(/^<|>$/g, ''), { targetId: pt.id, runId: pt.run_id });
          }
        }

        let lastUid = account.inbox_last_uid || 0;
        let newUidValidity = box.uidvalidity;
        if (account.inbox_uidvalidity && account.inbox_uidvalidity !== box.uidvalidity) {
          console.log(`[email-inbox] UIDVALIDITY changed from ${account.inbox_uidvalidity} to ${box.uidvalidity}. Resetting checkpoint.`);
          lastUid = 0;
        }

        const isFirstSync = (lastUid === 0);
        let highestUidProcessed = lastUid;
        let incrementalSuccess = true;

        await new Promise<void>((resRangeSearch) => {
          let searchCriteria: any[];
          if (isFirstSync) {
            const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const imapDate = `${d.getUTCDate()}-${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
            searchCriteria = [["SINCE", imapDate]];
          } else {
            searchCriteria = [["UID", `${lastUid + 1}:*`]];
          }

          imap.search(searchCriteria, async (searchErr, uids) => {
            if (searchErr || !uids || uids.length === 0) {
              resRangeSearch();
              return;
            }

            if (uids.length > 0) console.log(`[email-inbox] Incremental sync: fetched ${uids.length} new messages`);

            const fetchHeaders = imap.fetch(uids, {
              bodies: ["HEADER.FIELDS (FROM TO DATE MESSAGE-ID IN-REPLY-TO REFERENCES SUBJECT)"],
              struct: false,
            });

            type HeaderMsg = { uid: number; header: string };
            const headersList: HeaderMsg[] = [];

            fetchHeaders.on("message", (msg) => {
              const entry: HeaderMsg = { uid: 0, header: "" };
              msg.on("attributes", (attrs) => { entry.uid = attrs.uid; });
              msg.on("body", (stream) => {
                const chunks: Buffer[] = [];
                stream.on("data", (c: Buffer) => chunks.push(c));
                stream.once("end", () => { entry.header = Buffer.concat(chunks).toString(); });
              });
              msg.once("end", () => headersList.push(entry));
            });

            fetchHeaders.once("error", (err) => {
              console.warn(`[email-inbox] IMAP fetch headers error:`, err.message);
              incrementalSuccess = false;
              resRangeSearch();
            });

            fetchHeaders.once("end", () => {
              void (async () => {
                let matchedCount = 0;
                let ignoredCount = 0;

                for (const msg of headersList) {
                  try {
                    const fromRaw = parseHeaderValue(msg.header, "From");
                    const emailMatch = fromRaw.match(/<([^>]+)>/) ?? fromRaw.match(/([^\s]+@[^\s]+)/);
                    const fromEmail = emailMatch?.[1]?.toLowerCase().trim() || "";

                    const inReplyTo = parseHeaderValue(msg.header, "In-Reply-To").trim();
                    const referencesStr = parseHeaderValue(msg.header, "References");
                    const references = referencesStr.split(/\s+/).filter(Boolean).map(r => r.trim());

                    let targetId: string | undefined;
                    let runId: string | null = null;

                    // Priority 1: Correlation by Message-ID thread
                    if (inReplyTo && msgIdToContext.has(inReplyTo)) {
                      const ctx = msgIdToContext.get(inReplyTo)!;
                      targetId = ctx.targetId; runId = ctx.runId;
                    } else if (inReplyTo && msgIdToContext.has(inReplyTo.replace(/^<|>$/g, ''))) {
                      const ctx = msgIdToContext.get(inReplyTo.replace(/^<|>$/g, ''))!;
                      targetId = ctx.targetId; runId = ctx.runId;
                    }
                    if (!targetId) {
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
                    }

                    // Priority 2: Correlation by FROM email
                    if (!targetId && fromEmail) {
                      targetId = emailToTargetId.get(fromEmail);
                      if (targetId) console.log(`[email-inbox] run_id unresolved for ${fromEmail} (matched via Priority 2)`);
                    }

                    if (targetId) {
                      matchedCount++;
                      console.log(`[email-inbox] Reply detected for ${fromEmail} (target ${targetId})`);
                      replies++;

                      try {
                        const replyId = await captureReplyBody(imap, db, targetId, runId, fromEmail, msg.uid);
                        if (replyId && premium?.replies) {
                          await premium.replies.classifyAndDispatch(replyId);
                        }
                      } catch (err) {
                        console.warn(`[email-inbox] Failed to capture/dispatch reply for ${fromEmail}:`, err);
                        // We still consider the batch successful up to this point because errors in one target shouldn't break checkpointing of others.
                      }
                    } else {
                      ignoredCount++;
                    }

                    if (msg.uid > highestUidProcessed) {
                      highestUidProcessed = msg.uid;
                    }
                  } catch (e) {
                    console.warn(`[email-inbox] Error processing msg uid=${msg.uid}`, e);
                  }
                }

                resRangeSearch();
              })();
            });
          });
        });

        if (incrementalSuccess) {
          // First sync safety: force checkpoint to the mailbox's current high-water mark 
          // so we don't re-scan old emails in the next run, even if we found nothing recently.
          if (isFirstSync && box.uidnext) {
            highestUidProcessed = Math.max(highestUidProcessed, box.uidnext - 1);
          }

          if (highestUidProcessed > lastUid || isFirstSync) {
            db.prepare("UPDATE email_accounts SET inbox_last_uid = ?, inbox_uidvalidity = ? WHERE id = ?")
              .run(highestUidProcessed, newUidValidity, emailAccountId);
          }
        }

// ── Bounce detection: scan last 50 messages for mailer-daemon ─────────
        if (box.messages.total > 0) {
          const total = box.messages.total;
          const start = Math.max(1, total - 49);
          const range = `${start}:${total}`;

          await new Promise<void>((resFetch) => {
            const fetch = imap.seq.fetch(range, {
              bodies: ["HEADER.FIELDS (FROM TO)", "TEXT"],
              struct: false,
            });

            type RawMsg = { header: string; body: string };
            const msgs: RawMsg[] = [];

            fetch.on("message", (msg) => {
              const entry: RawMsg = { header: "", body: "" };
              msg.on("body", (stream, info) => {
                const chunks: Buffer[] = [];
                stream.on("data", (c: Buffer) => chunks.push(c));
                stream.once("end", () => {
                  const text = Buffer.concat(chunks).toString();
                  if (info.which.startsWith("HEADER")) entry.header = text;
                  else entry.body = text.slice(0, 3000);
                });
              });
              msg.once("end", () => msgs.push(entry));
            });

            fetch.once("error", () => resFetch());
            fetch.once("end", () => {
              for (const msg of msgs) {
                const fromRaw = parseHeaderValue(msg.header, "From");
                const toRaw = parseHeaderValue(msg.header, "To");

                const emailMatch = fromRaw.match(/<([^>]+)>/) ?? fromRaw.match(/([^\s]+@[^\s]+)/);
                const fromEmail = emailMatch?.[1]?.toLowerCase().trim();
                if (!fromEmail || !isBounce(fromEmail)) continue;

                // Also extract Final-Recipient from DSN bodies (SES bounce format)
                const finalRecipient = msg.body.match(/Final-Recipient:\s*rfc822;\s*([^\s\r\n]+)/i)?.[1] ?? "";
                const candidates = extractEmails(msg.body + " " + toRaw + " " + finalRecipient);
                for (const candidate of candidates) {
                  if (BOUNCE_SENDER_PATTERNS.some(p => p.test(candidate))) continue;

                  const target = db
                    .prepare("SELECT id, email_status, company_id FROM targets WHERE lower(email) = ?")
                    .get(candidate) as { id: string; email_status: string | null; company_id: string | null } | undefined;

                  if (!target || target.email_status === "invalid") continue;

                  const note = `Email bounced on ${new Date().toISOString().slice(0, 10)} — marked invalid`;
                  db.prepare(`
                    UPDATE targets SET email_status = 'invalid',
                      notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || char(10) || ? END
                    WHERE id = ?
                  `).run(note, note, target.id);

                  db.prepare(`
                    UPDATE run_profile_tracks SET state = 'skipped', error_message = 'Email bounced — invalid address'
                    WHERE run_profile_id IN (SELECT id FROM run_profiles WHERE target_id = ?)
                    AND state IN ('pending', 'in_progress')
                  `).run(target.id);

                  if (target.company_id) {
                    const companyNote = `Email domain flagged invalid — bounce for ${candidate} on ${new Date().toISOString().slice(0, 10)}`;
                    db.prepare(`
                      UPDATE companies SET email_domain_invalid = 1,
                        notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || char(10) || ? END
                      WHERE id = ?
                    `).run(companyNote, companyNote, target.company_id);

                    const siblings = db.prepare(`
                      SELECT id FROM targets WHERE company_id = ? AND id != ? AND email IS NOT NULL AND email_status != 'invalid'
                    `).all(target.company_id, target.id) as { id: string }[];

                    for (const sibling of siblings) {
                      const sibNote = `Email bounced on ${new Date().toISOString().slice(0, 10)} — marked invalid (domain flagged via company)`;
                      db.prepare(`
                        UPDATE targets SET email_status = 'invalid',
                          notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || char(10) || ? END
                        WHERE id = ?
                      `).run(sibNote, sibNote, sibling.id);
                      db.prepare(`
                        UPDATE run_profile_tracks SET state = 'skipped', error_message = 'Email domain invalid — company flagged'
                        WHERE run_profile_id IN (SELECT id FROM run_profiles WHERE target_id = ?)
                        AND state IN ('pending', 'in_progress')
                      `).run(sibling.id);
                    }

                    if (siblings.length > 0) {
                      console.log(`[email-inbox] Company ${target.company_id} flagged — ${siblings.length} sibling(s) marked invalid`);
                    }
                  }

                  console.log(`[email-inbox] Bounce for ${candidate} (target ${target.id}) — marked invalid`);
                  bounces++;
                  break;
                }
              }
              resFetch();
            });
          });
        }

        done();
      });
    });

    imap.connect();
  });

  db.prepare("UPDATE email_accounts SET inbox_synced_at = datetime('now') WHERE id = ?").run(emailAccountId);
  return { replies, bounces };
}
