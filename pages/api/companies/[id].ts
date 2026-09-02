import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = getDb();
  const id = req.query.id as string;

  if (req.method === "GET") {
    const company = db.prepare("SELECT * FROM companies WHERE id = ?").get(id);
    if (!company) return res.status(404).json({ error: "not found" });
    const contacts = db
      .prepare("SELECT id, full_name, title, email, linkedin_url FROM targets WHERE company_id = ? ORDER BY full_name")
      .all(id);
    return res.json({ ...company as object, contacts });
  }

  if (req.method === "PUT" || req.method === "PATCH") {
    const updates = { ...req.body };
    delete updates.id;
    delete updates.created_at;
    delete updates.contacts;
    
    if (Object.keys(updates).length > 0) {
      const keys = Object.keys(updates);
      const setClause = keys.map(k => `${k} = ?`).join(', ');
      const values = keys.map(k => updates[k]);
      
      db.prepare(`
        UPDATE companies SET ${setClause} WHERE id = ?
      `).run(...values, id);
    }
    
    const updated = db.prepare("SELECT * FROM companies WHERE id = ?").get(id);
    const contacts = db.prepare("SELECT id, full_name, title, email, linkedin_url FROM targets WHERE company_id = ? ORDER BY full_name").all(id);
    return res.json({ ...(updated as object), contacts });
  }

  if (req.method === "DELETE") {
    // Unlink contacts first, then delete company
    db.prepare("UPDATE targets SET company_id = NULL WHERE company_id = ?").run(id);
    db.prepare("DELETE FROM companies WHERE id = ?").run(id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
