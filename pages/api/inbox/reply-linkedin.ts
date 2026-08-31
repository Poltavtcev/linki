import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const { accountId, targetId, threadId, body } = req.body;
  
  if (!accountId || !targetId || !threadId || !body) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO linkedin_reply_queue (id, account_id, target_id, thread_id, body)
      VALUES (?, ?, ?, ?, ?)
    `).run(randomUUID(), accountId, targetId, threadId, body);
    
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
}
