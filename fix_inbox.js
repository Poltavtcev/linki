const fs = require('fs');
let code = fs.readFileSync('pages/inbox.tsx', 'utf8');

// 1. Fix handleSend
const oldHandleSend = `  async function handleSend() {
    if (!replyText.trim() || !reply.email || !reply.email_account_id) return;
    setSending(true);
    try {
      const r = await fetch("/api/inbox/reply", {`;

const newHandleSend = `  async function handleSend() {
    if (!replyText.trim()) return;

    if (reply.channel === "linkedin" || reply.channel === "both") {
      if (reply.account_id && reply.linkedin_thread_id) {
        setSending(true);
        try {
          const r = await fetch("/api/inbox/reply-linkedin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accountId: reply.account_id,
              targetId: reply.id,
              threadId: reply.linkedin_thread_id,
              body: replyText,
            }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error ?? "Send failed");
          setReplyText("");
          onClose(); // Optional: close modal
        } catch (err) {
          // just catch
        } finally {
          setSending(false);
        }
        return;
      }
    }

    if (!reply.email || !reply.email_account_id) return;
    setSending(true);
    try {
      const r = await fetch("/api/inbox/reply", {`;

code = code.replace(oldHandleSend, newHandleSend);

// 2. Hide subject line
const oldSubject = `          <div className="border-t border-base-300/50 px-5 py-4 space-y-2.5">
            <input
              type="text"
              value={replySubject}
              onChange={(e) => setReplySubject(e.target.value)}
              placeholder="Subject"
              className="w-full bg-base-200 border border-base-300/50 rounded-lg px-3 py-1.5 text-sm text-base-content placeholder:text-base-content/30 focus:outline-none focus:border-primary/40"
            />
            <textarea`;

const newSubject = `          <div className="border-t border-base-300/50 px-5 py-4 space-y-2.5">
            {(reply.channel !== "linkedin" && reply.channel !== "both") && (
              <input
                type="text"
                value={replySubject}
                onChange={(e) => setReplySubject(e.target.value)}
                placeholder="Subject"
                className="w-full bg-base-200 border border-base-300/50 rounded-lg px-3 py-1.5 text-sm text-base-content placeholder:text-base-content/30 focus:outline-none focus:border-primary/40"
              />
            )}
            <textarea`;

code = code.replace(oldSubject, newSubject);

fs.writeFileSync('pages/inbox.tsx', code);
console.log("Done");
