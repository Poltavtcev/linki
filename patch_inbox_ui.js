const fs = require('fs');
let content = fs.readFileSync('pages/inbox.tsx', 'utf8');

const newHandleSend = `async function handleSend() {
    if (!replyText.trim()) return;

    if (reply.channel === "linkedin") {
      if (!reply.account_id || !reply.linkedin_thread_id) {
        toast.error("Missing account or thread ID for LinkedIn reply");
        return;
      }
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
        toast.success("LinkedIn reply queued");
        setReplyText("");
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to queue reply");
      } finally {
        setSending(false);
      }
      return;
    }

    if (!reply.email || !reply.email_account_id) return;
    setSending(true);`;

content = content.replace(/async function handleSend\(\) \{\n    if \(\!replyText\.trim\(\)\) return;\n    if \(\!reply\.email \|\| \!reply\.email_account_id\) return;\n    setSending\(true\);/, newHandleSend);

content = content.replace(/const canReply = \!\!reply\.email \&\& \!\!reply\.email_account_id;/, 'const canReply = (reply.channel === "linkedin" && !!reply.account_id && !!reply.linkedin_thread_id) || (!!reply.email && !!reply.email_account_id);');

const subjectInput = `            {reply.channel !== "linkedin" && (
              <input
                type="text"
                value={replySubject}
                onChange={(e) => setReplySubject(e.target.value)}
                placeholder="Subject..."
                className="w-full bg-base-100 border border-base-300/50 rounded-lg px-3 py-2 text-sm text-base-content focus:outline-none focus:border-primary/40 mb-3"
              />
            )}`;

content = content.replace(/<input\n                type="text"\n                value=\{replySubject\}\n                onChange=\{\(e\) => setReplySubject\(e\.target\.value\)\}\n                placeholder="Subject\.\.\."\n                className="w-full bg-base-100 border border-base-300\/50 rounded-lg px-3 py-2 text-sm text-base-content focus:outline-none focus:border-primary\/40 mb-3"\n              \/>/, subjectInput);

fs.writeFileSync('pages/inbox.tsx', content);
