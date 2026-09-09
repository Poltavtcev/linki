import { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const db = getDb();

  if (req.method === "GET") {
    const drafts = db.prepare(`
      SELECT d.*, t.full_name as target_name, t.title as target_title, t.company as target_company 
      FROM ai_drafts d
      JOIN runs r ON d.run_id = r.id
      JOIN targets t ON d.target_id = t.id
      WHERE r.workflow_id = ? AND d.status = 'pending'
      ORDER BY d.created_at ASC
    `).all(id);
    return res.status(200).json({ drafts });
  }

  res.status(405).end();
}
