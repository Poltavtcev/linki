const fs = require('fs');
let code = fs.readFileSync('pages/api/inbox/thread.ts', 'utf8');

const oldLinkedinMessages = `    const dbMessagesRows = db.prepare("SELECT * FROM email_replies WHERE target_id = ? AND from_email LIKE 'urn:li:%'").all(targetId) as any[];
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
    }));`;

const newLinkedinMessages = `    const dbMessagesRows = db.prepare("SELECT * FROM email_replies WHERE target_id = ? AND from_email LIKE 'urn:li:%'").all(targetId) as any[];
    const manualQueueRows = db.prepare("SELECT * FROM linkedin_reply_queue WHERE target_id = ?").all(targetId) as any[];
    
    let uidCounter = -1;
    const linkedinMessages: EmailMessage[] = dbMessagesRows.map(r => ({
      uid: uidCounter--,
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
    
    for (const q of manualQueueRows) {
      linkedinMessages.push({
        uid: uidCounter--,
        from: "You (LinkedIn)",
        to: "Target",
        subject: "LinkedIn Message (Manual)",
        date: new Date(q.created_at).toISOString(),
        text: q.body + (q.status === 'pending' || q.status === 'processing' ? ' [⏳ Queued]' : (q.status === 'failed' ? ' [❌ Failed]' : '')),
        html: null,
        messageId: q.id,
        inReplyTo: q.thread_id,
        references: []
      });
    }`;

code = code.replace(oldLinkedinMessages, newLinkedinMessages);
fs.writeFileSync('pages/api/inbox/thread.ts', code);
