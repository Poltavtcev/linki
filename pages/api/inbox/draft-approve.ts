import { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const db = getDb();
  const { draftId } = req.body;

  if (!draftId) return res.status(400).json({ error: "Missing draftId" });

  try {
    const draft = db.prepare("SELECT * FROM ai_drafts WHERE id = ?").get(draftId) as any;
    if (!draft) return res.status(404).json({ error: "Draft not found" });
    if (draft.status !== 'pending') return res.status(400).json({ error: "Draft is not pending" });

    // Fetch the target and account info
    const runProfile = db.prepare("SELECT target_id, run_id FROM run_profiles WHERE id = ?").get(draft.run_profile_id) as any;
    if (!runProfile) return res.status(404).json({ error: "Run profile not found" });

    const run = db.prepare("SELECT account_id FROM runs WHERE id = ?").get(runProfile.run_id) as any;
    if (!run) return res.status(404).json({ error: "Run not found" });

    const targetId = runProfile.target_id;
    const accountId = run.account_id;

    // We need thread_id. Let's try to get it from email_replies or targets table.
    // If it's a LinkedIn draft, it goes to linkedin_reply_queue which requires thread_id.
    const target = db.prepare("SELECT messaging_urn FROM targets WHERE id = ?").get(targetId) as any;
    let threadId = target?.messaging_urn;
    
    if (!threadId) {
      const lastReply = db.prepare("SELECT thread_id FROM email_replies WHERE target_id = ? AND thread_id IS NOT NULL ORDER BY received_at DESC LIMIT 1").get(targetId) as any;
      if (lastReply) threadId = lastReply.thread_id;
    }
    
    if (!threadId) return res.status(400).json({ error: "Could not resolve thread ID for target" });

    const queueId = randomUUID();

    db.transaction(() => {
      // 1. Update draft status
      db.prepare("UPDATE ai_drafts SET status = 'approved' WHERE id = ?").run(draftId);
      
      // 2. Insert to queue
      db.prepare(`INSERT INTO linkedin_reply_queue (id, account_id, target_id, thread_id, body) VALUES (?, ?, ?, ?, ?)`)
        .run(queueId, accountId, targetId, threadId, draft.generated_text);
    })();

    return res.status(200).json({ success: true, queueId });
  } catch (err) {
    console.error("[draft-approve] Error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
