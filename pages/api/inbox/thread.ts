import type { NextApiRequest, NextApiResponse } from "next";
import Imap from "imap";
import { simpleParser } from "mailparser";
import { getDb } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";

export interface EmailMessage {
  uid: number;
  from: string;
  to: string;
  subject: string;
  date: string;
  text: string;
  html: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end();
  }

  const targetId = req.query.targetId as string | undefined;
  const emailAccountId = req.query.emailAccountId as string | undefined;
  if (!targetId) return res.status(400).json({ error: "targetId required" });

  const db = getDb();

  const target = db.prepare("SELECT email FROM targets WHERE id = ?").get(targetId) as { email: string | null } | undefined;
  // Allow fetching even without email for pure LinkedIn targets

  const account = emailAccountId ? db.prepare(
    "SELECT imap_host, imap_port, username, password, imap_username, imap_password FROM email_accounts WHERE id = ?"
  ).get(emailAccountId) as {
    imap_host: string | null; imap_port: number | null;
    username: string; password: string;
    imap_username: string | null; imap_password: string | null;
  } | undefined : undefined;


  // Skip IMAP if no account configured (e.g. for purely LinkedIn threads)

  const imapUser = account?.imap_username ?? account?.username ?? "";
  const imapPass = account ? (decryptSecret(account.imap_password) ?? decryptSecret(account.password)!) : "";
  const targetEmail = target?.email?.toLowerCase() ?? "";

  try {
    
    const legacyRows = db.prepare("SELECT received_at FROM email_replies WHERE target_id = ? AND message_id IS NULL").all(targetId) as { received_at: string }[];
    const legacyTimes = new Set(legacyRows.map(r => new Date(r.received_at).getTime()));
    
    const knownIdsRows = db.prepare(`
      SELECT last_email_message_id AS msg_id FROM run_profile_tracks rt
      JOIN run_profiles rp ON rp.id = rt.run_profile_id
      WHERE rp.target_id = ? AND rt.last_email_message_id IS NOT NULL
      UNION
      SELECT message_id AS msg_id FROM email_replies WHERE target_id = ? AND message_id IS NOT NULL
    `).all(targetId, targetId) as { msg_id: string }[];
    const knownMessageIds = new Set(knownIdsRows.map(r => r.msg_id.trim().replace(/^<|>$/g, '')));
    const ownerEmail = account?.username?.toLowerCase() ?? "";

    
    const dbMessagesRows = db.prepare("SELECT * FROM email_replies WHERE target_id = ? AND from_email LIKE 'urn:li:member:%'").all(targetId) as any[];
    const linkedinMessages: EmailMessage[] = dbMessagesRows.map((r, idx) => ({
      uid: -idx - 1,
      from: r.subject || r.from_email,
      to: "You (LinkedIn)",
      subject: "LinkedIn Message",
      date: new Date(r.received_at).toISOString(),
      text: r.body_text,
      html: null,
      messageId: r.message_id,
      inReplyTo: r.in_reply_to,
      references: []
    }));
    
    let messages = linkedinMessages;
    if (account?.imap_host && targetEmail) {
      const emailMessages = await fetchThread(
      { host: account.imap_host, port: account.imap_port ?? 993, user: imapUser, password: imapPass },
      targetEmail,
      ownerEmail,
      knownMessageIds,
      legacyTimes
    );
      messages = [...linkedinMessages, ...emailMessages];
    }
    messages.sort((a, b) => a.date.localeCompare(b.date));
    return res.json({ messages });
  } catch (err) {
    console.error("[inbox/thread] IMAP error:", err);
    return res.status(500).json({ error: "IMAP fetch failed" });
  }
}

interface ImapConfig { host: string; port: number; user: string; password: string; }

async function fetchThread(cfg: ImapConfig, contactEmail: string, ownerEmail: string, knownMessageIds: Set<string>, legacyTimes: Set<number>): Promise<EmailMessage[]> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      host: cfg.host,
      port: cfg.port,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      user: cfg.user,
      password: cfg.password,
      authTimeout: 10_000,
      connTimeout: 12_000,
    });

    const done = (err?: Error) => {
      try { imap.end(); } catch { /* ignore */ }
      if (err) reject(err);
    };

    const messages: EmailMessage[] = [];

    imap.once("error", (err: Error) => done(err));
    imap.once("ready", () => {
      imap.openBox("INBOX", true, (boxErr) => {
        if (boxErr) { done(boxErr); return; }

        // Search for messages FROM or TO the contact
        imap.search([["OR", ["FROM", contactEmail], ["TO", contactEmail]]], (searchErr, uids) => {
          if (searchErr) { done(searchErr); return; }
          if (uids.length === 0) { resolve([]); done(); return; }

          // Fetch the last 20 matching messages max
          const toFetch = uids.slice(-20);
          const fetch = imap.fetch(toFetch, { bodies: "", struct: false });
          const pending: Promise<void>[] = [];

          fetch.on("message", (msg) => {
            let uid = 0;
            msg.on("attributes", (attrs) => { uid = attrs.uid; });

            const p = new Promise<void>((res2) => {
              const chunks: Buffer[] = [];
              let bodyEnded = false;

              msg.on("body", (stream) => {
                stream.on("data", (c: Buffer) => chunks.push(c));
                stream.once("end", async () => {
                  bodyEnded = true;
                  try {
                    const parsed = await simpleParser(Buffer.concat(chunks));
                    messages.push({
                      uid,
                      from: parsed.from?.text ?? "",
                      to: parsed.to ? (Array.isArray(parsed.to) ? parsed.to.map(a => a.text).join(", ") : parsed.to.text) : "",
                      subject: parsed.subject ?? "(no subject)",
                      date: parsed.date?.toISOString() ?? new Date().toISOString(),
                      text: parsed.text ?? "",
                      html: parsed.html || null,
                      messageId: parsed.messageId ?? null,
                      inReplyTo: parsed.inReplyTo ?? null,
                      references: typeof parsed.references === 'string' ? parsed.references.split(/\s+/) : (parsed.references || []),
                    });
                  } catch { /* skip malformed */ }
                  res2();
                });
              });

              // Only use msg.end as fallback if no body was received
              msg.once("end", () => { if (!bodyEnded) res2(); });
            });
            pending.push(p);
          });

          fetch.once("error", (fetchErr: Error) => done(fetchErr));
          fetch.once("end", async () => {
            await Promise.allSettled(pending);
            
            // Build undirected thread graph to isolate conversation
            let finalMessages = messages;
            
            // Step 1: Promote legacy IMAP messages to root nodes if their timestamps match legacy DB records
            for (const m of messages) {
              if (m.messageId && legacyTimes.has(new Date(m.date).getTime())) {
                knownMessageIds.add(m.messageId.replace(/^<|>$/g, ''));
              }
            }

            if (knownMessageIds.size > 0) {
              const graph = new Map<string, Set<string>>();
              const addEdge = (u: string, v: string) => {
                if (!graph.has(u)) graph.set(u, new Set());
                if (!graph.has(v)) graph.set(v, new Set());
                graph.get(u)!.add(v);
                graph.get(v)!.add(u);
              };

              for (const m of messages) {
                if (!m.messageId) continue;
                const u = m.messageId.replace(/^<|>$/g, '');
                const rawRefs = [m.inReplyTo, ...(m.references || [])];
                const refs = rawRefs
                  .filter((r): r is string => typeof r === 'string')
                  .map(r => r.replace(/^<|>$/g, ''));
                for (const v of refs) addEdge(u, v);
              }

              const connected = new Set<string>();
              const queue = [...knownMessageIds];
              
              while (queue.length > 0) {
                const curr = queue.pop()!;
                if (connected.has(curr)) continue;
                connected.add(curr);
                if (graph.has(curr)) {
                  for (const neighbor of graph.get(curr)!) {
                    if (!connected.has(neighbor)) queue.push(neighbor);
                  }
                }
              }
              
              finalMessages = messages.filter(m => m.messageId && connected.has(m.messageId.replace(/^<|>$/g, '')));
            }

            finalMessages.sort((a, b) => a.date.localeCompare(b.date));
            resolve(finalMessages);
            done();
          });
        });
      });
    });

    imap.connect();
  });
}
