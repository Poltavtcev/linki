import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
import { premium } from "@/ee";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  if (!premium?.replies) {
    return res.status(403).json({ error: "AI Premium feature not available." });
  }

  const replyId = req.query.replyId as string;
  if (!replyId) {
    return res.status(400).json({ error: "Missing replyId" });
  }

  const db = getDb();
  
  // Verify reply exists
  const row = db.prepare("SELECT id FROM email_replies WHERE id = ?").get(replyId);
  if (!row) {
    return res.status(404).json({ error: "Reply not found" });
  }

  try {
    await premium.replies.classifyAndDispatch(replyId);
    
    const updated = db.prepare(`
      SELECT classification_json, classification_error, classified_at 
      FROM email_replies 
      WHERE id = ?
    `).get(replyId);

    return res.json({ success: true, updated });
  } catch (err: any) {
    console.error(`[reclassify] Failed for reply ${replyId}:`, err);
    return res.status(500).json({ error: err.message || "Failed to reclassify reply" });
  }
}
