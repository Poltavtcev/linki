"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureSdrInboundMessage = captureSdrInboundMessage;
function captureSdrInboundMessage(db, msg) {
    var _a;
    // Check idempotency via eventId
    var existing = db.prepare("SELECT id FROM email_replies WHERE id = ?").get(msg.eventId);
    if (existing) {
        return { messageId: msg.eventId, duplicate: true };
    }
    // Resolve active run
    var activeRun = db.prepare("\n    SELECT rp.run_id \n    FROM run_profiles rp\n    JOIN run_profile_tracks rpt ON rpt.run_profile_id = rp.id\n    WHERE rp.target_id = ? AND rpt.state IN ('pending', 'in_progress')\n    LIMIT 1\n  ").get(msg.targetId);
    db.prepare("\n    INSERT INTO email_replies (\n      id, target_id, run_id, message_id, in_reply_to, from_email, subject, body_text, received_at\n    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\n  ").run(msg.eventId, msg.targetId, (_a = activeRun === null || activeRun === void 0 ? void 0 : activeRun.run_id) !== null && _a !== void 0 ? _a : null, msg.externalMessageId, msg.externalThreadId, msg.senderExternalId, // storing URN as from_email for internal consistency
    msg.senderName, // storing sender name as subject
    msg.body, msg.receivedAt);
    // Update target stamp for LinkedIn replies
    db.prepare("UPDATE targets SET last_replied_at = ? WHERE id = ?").run(msg.receivedAt, msg.targetId);
    return { messageId: msg.eventId, duplicate: false };
}
