import { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { draft_id } = req.query;
  const db = getDb();

  if (req.method === "PATCH") {
    const { body, status } = req.body;
    
    db.prepare(`UPDATE ai_drafts SET body = ?, status = ?, updated_at = datetime('now') WHERE id = ?`).run(body, status, draft_id);
    
    if (status === 'approved' || status === 'rejected') {
       const draft = db.prepare("SELECT run_profile_id FROM ai_drafts WHERE id = ?").get(draft_id) as any;
       if (draft) {
          db.prepare("UPDATE run_profile_states SET state = 'running', waiting_for_condition = NULL WHERE run_profile_id = ?").run(draft.run_profile_id);
       }
    }
    
    return res.status(200).json({ success: true });
  }

  res.status(405).end();
}
