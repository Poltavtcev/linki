import type Database from "better-sqlite3";
import { randomUUID } from "crypto";

export interface SdrInboundMessage {
  eventId: string;
  channel: "linkedin" | "email";
  targetId: string;
  accountId: string;
  emailAccountId: string | null;
  externalThreadId: string;
  externalMessageId: string;
  senderExternalId: string | null;
  senderName: string | null;
  body: string;
  receivedAt: string;
  metadata: Record<string, unknown>;
}

export interface CapturedInboundMessage {
  messageId: string;
  duplicate: boolean;
}

export function captureSdrInboundMessage(db: Database.Database, msg: SdrInboundMessage): CapturedInboundMessage {
  // Check idempotency via eventId
  const existing = db.prepare("SELECT id FROM email_replies WHERE id = ?").get(msg.eventId);
  if (existing) {
    return { messageId: msg.eventId, duplicate: true };
  }

  // Resolve active run
  const activeRun = db.prepare(
    "SELECT run_id FROM run_profiles WHERE target_id = ? AND state IN ('pending', 'in_progress')"
  ).get(msg.targetId) as { run_id: string } | undefined;

  db.prepare(`
    INSERT INTO email_replies (
      id, target_id, run_id, message_id, in_reply_to, from_email, subject, body_text, received_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    msg.eventId,
    msg.targetId,
    activeRun?.run_id ?? null,
    msg.externalMessageId,
    msg.externalThreadId,
    msg.senderExternalId, // storing URN as from_email for internal consistency
    msg.senderName,       // storing sender name as subject
    msg.body,
    msg.receivedAt
  );

  // Update target stamp for LinkedIn replies
  db.prepare("UPDATE targets SET last_replied_at = ? WHERE id = ?").run(msg.receivedAt, msg.targetId);

  return { messageId: msg.eventId, duplicate: false };
}
