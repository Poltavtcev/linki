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
  const activeRun = db.prepare(`
    SELECT rp.run_id, rp.id AS run_profile_id
    FROM run_profiles rp
    JOIN run_profile_tracks rpt ON rpt.run_profile_id = rp.id
    WHERE rp.target_id = ? AND rpt.state IN ('pending', 'in_progress')
    LIMIT 1
  `).get(msg.targetId) as { run_id: string, run_profile_id: string } | undefined;

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

  // Apply DAG Phase 5 on_replied transition
  if (activeRun) {
    let onRepliedStepId: string | null = null;

    const outboundEvent = db.prepare(`
      SELECT step_id FROM outbound_events
      WHERE run_profile_id = ? AND channel = 'linkedin' AND status = 'sent'
      ORDER BY sent_at DESC, rowid DESC LIMIT 1
    `).get(activeRun.run_profile_id) as { step_id: string } | undefined;

    if (outboundEvent) {
      const stepWithEdge = db.prepare(`
        SELECT edges_json FROM workflow_steps
        WHERE id = ?
      `).get(outboundEvent.step_id) as { edges_json: string } | undefined;

      if (stepWithEdge?.edges_json) {
        try {
          const edges = JSON.parse(stepWithEdge.edges_json) as Record<string, string>;
          onRepliedStepId = edges["on_replied"] ?? null;
        } catch {}
      }
    }

    if (onRepliedStepId) {
      db.prepare(`
        UPDATE run_profile_states
        SET current_step_id = ?,
            state = 'pending',
            waiting_for_condition = NULL,
            next_eval_at = datetime('now')
        WHERE run_profile_id = ?
      `).run(onRepliedStepId, activeRun.run_profile_id);
    } else {
      // G2: PAUSE the specific run_profile if uncorrelated (known run_profile, unknown outbound correlation)
      db.prepare(`
        UPDATE run_profile_states
        SET state = 'paused',
            waiting_for_condition = 'uncorrelated_reply',
            next_eval_at = NULL
        WHERE run_profile_id = ?
      `).run(activeRun.run_profile_id);
    }
  }

  // Update target stamp for LinkedIn replies
  db.prepare("UPDATE targets SET last_replied_at = ? WHERE id = ?").run(msg.receivedAt, msg.targetId);

  return { messageId: msg.eventId, duplicate: false };
}
