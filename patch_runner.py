import re

with open('lib/linkedin/runner.ts', 'r') as f:
    content = f.read()

# 1. Message idempotency
msg_start = r'} else if \(step\.step_type === "message"\) \{'
msg_dedupe = """} else if (step.step_type === "message") {
      const _existingMessage = db.prepare("SELECT body FROM outbound_events WHERE run_profile_id = ? AND step_id = ? AND channel = 'linkedin'").get(runProfileId, step.id) as any;
      if (_existingMessage) {
        log(db, runId, target.id, "info", `Idempotency: message already sent for step ${step.id}, returning persisted success.`);
        return { status: "SUCCESS", context: { linkedinMessage: _existingMessage.body } };
      }"""
content = re.sub(msg_start, msg_dedupe, content)

msg_success = r'return \{ status: "SUCCESS", context: \{ linkedinMessage: messageText \} \};'
msg_insert = """
      db.prepare(`
        INSERT INTO outbound_events (id, run_id, run_profile_id, target_id, step_id, channel, sent_at, status, body)
        VALUES (?, ?, ?, ?, ?, 'linkedin', datetime('now'), 'sent', ?)
      `).run(require("crypto").randomUUID(), runId, runProfileId, target.id, step.id, messageText);
      return { status: "SUCCESS", context: { linkedinMessage: messageText } };
"""
content = re.sub(msg_success, msg_insert.strip(), content)

# 2. Email idempotency
email_start = r'} else if \(step\.step_type === "email"\) \{'
email_dedupe = """} else if (step.step_type === "email") {
      const _existingEmail = db.prepare("SELECT message_id, body FROM outbound_events WHERE run_profile_id = ? AND step_id = ? AND channel = 'email'").get(runProfileId, step.id) as any;
      if (_existingEmail) {
        log(db, runId, target.id, "info", `Idempotency: email already sent for step ${step.id}, returning persisted success.`);
        return { status: "SUCCESS", context: { emailSubject: step.email_subject || "", emailBody: _existingEmail.body, emailMessageId: _existingEmail.message_id } };
      }"""
content = re.sub(email_start, email_dedupe, content)

email_success = r'return \{ status: "SUCCESS", context: \{ emailSubject, emailBody: emailText, emailMessageId: msgId \} \};'
email_insert = """
        db.prepare(`
          INSERT INTO outbound_events (id, run_id, run_profile_id, target_id, step_id, channel, sent_at, message_id, status, body)
          VALUES (?, ?, ?, ?, ?, 'email', datetime('now'), ?, 'sent', ?)
        `).run(require("crypto").randomUUID(), runId, runProfileId, target.id, step.id, msgId, emailText);
        return { status: "SUCCESS", context: { emailSubject, emailBody: emailText, emailMessageId: msgId } };
"""
content = re.sub(email_success, email_insert.strip(), content)

# 3. Remove tickActions insert
tick_insert = r"          if \(returnState === 'SUCCESS' && \(step\.step_type === 'message' \|\| step\.step_type === 'email'\)\) \{\n             const channel = step\.step_type === 'message' \? 'linkedin' : 'email';\n             const ctx = \(result\.status === \"SUCCESS\" \? result\.context : \{\}\) \|\| \{\};\n             const msgId = ctx\.emailMessageId \|\| null;\n             const body = ctx\.linkedinMessage \|\| ctx\.emailBody \|\| null;\n             db\.prepare\(`\n               INSERT INTO outbound_events \(id, run_id, run_profile_id, target_id, step_id, channel, sent_at, message_id, status, body\)\n               VALUES \(\?, \?, \?, \?, \?, \?, datetime\('now'\), \?, 'sent', \?\)\n             `\)\.run\(randomUUID\(\), state\.run_id, state\.run_profile_id, state\.target_id, step\.id, channel, msgId, body\);\n          \}"
content = re.sub(tick_insert, "", content, flags=re.MULTILINE)

with open('lib/linkedin/runner.ts', 'w') as f:
    f.write(content)
