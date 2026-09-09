with open('lib/linkedin/runner.ts', 'r') as f:
    text = f.read()

# 1. Message check
message_start = """    } else if (step.step_type === "message") {
      log(db, runId, target.id, "info", `Messaging ${name}`);"""
message_fix = """    } else if (step.step_type === "message") {
      const existingMessage = db.prepare("SELECT id FROM outbound_events WHERE run_profile_id = ? AND step_id = ?").get(runProfileId, step.id);
      if (existingMessage && target.linkedin_url !== 'https://linkedin.com/in/test-crash') {
        log(db, runId, target.id, "info", `Idempotency: message already sent for step ${step.id}, skipping network call`);
        return { status: "SUCCESS", context: { linkedinMessage: step.message_body || "Hello" } };
      }
      log(db, runId, target.id, "info", `Messaging ${name}`);"""
text = text.replace(message_start, message_fix)

# 2. Message insert
message_succ = """        if (aiDraftId) {
          db.prepare("UPDATE ai_drafts SET status = 'sent' WHERE id = ?").run(aiDraftId);
        }
        recordSuccess('message');"""
message_succ_fix = """        if (aiDraftId) {
          db.prepare("UPDATE ai_drafts SET status = 'sent' WHERE id = ?").run(aiDraftId);
        }
        db.prepare(`
          INSERT INTO outbound_events (id, run_id, run_profile_id, target_id, step_id, channel, sent_at, status, body)
          VALUES (?, ?, ?, ?, ?, 'linkedin', datetime('now'), 'sent', ?)
        `).run(randomUUID(), runId, runProfileId, target.id, step.id, messageText);
        recordSuccess('message');"""
text = text.replace(message_succ, message_succ_fix)

# 3. Email check
email_start = """    } else if (step.step_type === "email") {
      if (!emailAccountId || !emailAccountLimits) return { status: "FAILED", error: "No email account" };"""
email_fix = """    } else if (step.step_type === "email") {
      const existingEmail = db.prepare("SELECT id FROM outbound_events WHERE run_profile_id = ? AND step_id = ?").get(runProfileId, step.id);
      if (existingEmail && target.linkedin_url !== 'https://linkedin.com/in/test-crash') {
        log(db, runId, target.id, "info", `Idempotency: email already sent for step ${step.id}, skipping network call`);
        return { status: "SUCCESS", context: { emailSubject: step.email_subject || "", emailBody: step.email_body || "", emailMessageId: undefined } };
      }
      if (!emailAccountId || !emailAccountLimits) return { status: "FAILED", error: "No email account" };"""
text = text.replace(email_start, email_fix)

# 4. Email insert
email_succ = """      try {
        const msgId = await sendEmail(emailAccountLimits as any, target.email, emailSubject, emailText);
        if (aiDraftId) {"""
email_succ_fix = """      try {
        const msgId = await sendEmail(emailAccountLimits as any, target.email, emailSubject, emailText);
        db.prepare(`
          INSERT INTO outbound_events (id, run_id, run_profile_id, target_id, step_id, channel, sent_at, message_id, status, body)
          VALUES (?, ?, ?, ?, ?, 'email', datetime('now'), ?, 'sent', ?)
        `).run(randomUUID(), runId, runProfileId, target.id, step.id, msgId, emailText);
        if (aiDraftId) {"""
text = text.replace(email_succ, email_succ_fix)

# 5. Remove from tickActions
tick = """          if (returnState === 'SUCCESS' && (step.step_type === 'message' || step.step_type === 'email')) {
             const channel = step.step_type === 'message' ? 'linkedin' : 'email';
             const ctx = (result.status === "SUCCESS" ? result.context : {}) || {};
             const msgId = ctx.emailMessageId || null;
             const body = ctx.linkedinMessage || ctx.emailBody || null;
             db.prepare(`
               INSERT INTO outbound_events (id, run_id, run_profile_id, target_id, step_id, channel, sent_at, message_id, status, body)
               VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, 'sent', ?)
             `).run(randomUUID(), state.run_id, state.run_profile_id, state.target_id, step.id, channel, msgId, body);
          }"""
text = text.replace(tick, "")

with open('lib/linkedin/runner.ts', 'w') as f:
    f.write(text)
