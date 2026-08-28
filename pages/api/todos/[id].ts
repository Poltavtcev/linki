import { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
const db = getDb();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing or invalid id" });
  }

  if (req.method === "PATCH") {
    const { title, description, due_date, status } = req.body;
    
    const sets = [];
    const params = [];

    if (title !== undefined) { sets.push("title = ?"); params.push(title.trim()); }
    if (description !== undefined) { sets.push("description = ?"); params.push(description?.trim() || null); }
    if (due_date !== undefined) { sets.push("due_date = ?"); params.push(due_date || null); }
    if (status !== undefined) { sets.push("status = ?"); params.push(status); }

    if (sets.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    params.push(id);
    db.prepare(`UPDATE todos SET ${sets.join(", ")} WHERE id = ?`).run(...params);

    const todo = db.prepare(`
      SELECT todos.*, targets.first_name, targets.last_name, targets.company as company_name 
      FROM todos 
      JOIN targets ON todos.target_id = targets.id 
      WHERE todos.id = ?
    `).get(id);

    return res.status(200).json(todo);
  }

  if (req.method === "DELETE") {
    db.prepare(`DELETE FROM todos WHERE id = ?`).run(id);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
