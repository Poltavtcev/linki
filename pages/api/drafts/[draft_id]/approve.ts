import { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).end();

  const { draft_id } = req.query;
  const db = getDb();

  const draft = db.prepare(`SELECT * FROM ai_drafts WHERE id = ?`).get(draft_id) as any;
  if (!draft) return res.status(404).json({ error: "Draft not found" });

  db.prepare(`UPDATE ai_drafts SET status = 'approved', updated_at = datetime('now') WHERE id = ?`).run(draft_id);
  db.prepare(`UPDATE run_profile_states SET state = 'pending', waiting_for_condition = NULL WHERE run_profile_id = ?`).run(draft.run_profile_id);

  return res.json({ success: true });
}
