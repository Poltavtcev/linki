import { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = getDb();
  const id = req.query.id as string;

  if (req.method === "GET") {
    try {
      const row = db.prepare("SELECT * FROM reply_contexts WHERE workflow_id = ?").get(id);
      return res.status(200).json(row || {});
    } catch (e) {
      console.error(e); return res.status(500).json({ error: "DB Error", details: e instanceof Error ? e.message : String(e) });
    }
  }

  if (req.method === "PUT") { console.log("PUT /reply-context called for", id);
    const { is_active, sender_profile, company_product, offers_playbook, voice_rules } = req.body;
    try {
      db.prepare(`
        INSERT INTO reply_contexts (workflow_id, is_active, sender_profile, company_product, offers_playbook, voice_rules)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(workflow_id) DO UPDATE SET
          is_active = excluded.is_active,
          sender_profile = excluded.sender_profile,
          company_product = excluded.company_product,
          offers_playbook = excluded.offers_playbook,
          voice_rules = excluded.voice_rules,
          updated_at = CURRENT_TIMESTAMP
      `).run(id, is_active ? 1 : 0, sender_profile, company_product, offers_playbook, voice_rules);
      return res.status(200).json({ success: true });
    } catch (e) {
      console.error(e); return res.status(500).json({ error: "DB Error", details: e instanceof Error ? e.message : String(e) });
    }
  }

  return res.status(405).end();
}
