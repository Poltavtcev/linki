import { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
const db = getDb();
import { randomUUID } from "crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  if (req.method === "GET") {
    const todos = db.prepare(`
      SELECT todos.*, 
             targets.first_name, 
             targets.last_name, 
             targets.company as company_name
      FROM todos
      JOIN targets ON todos.target_id = targets.id
      ORDER BY todos.status ASC, todos.due_date ASC, todos.created_at DESC
    `).all();
    return res.status(200).json(todos);
  }

  if (req.method === "POST") {
    const { target_id, title, description, due_date } = req.body;
    if (!target_id || !title) {
      return res.status(400).json({ error: "target_id and title are required" });
    }

    const id = randomUUID();
    db.prepare(`
      INSERT INTO todos (id, target_id, title, description, due_date)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, target_id, title.trim(), description?.trim() || null, due_date || null);

    const todo = db.prepare(`
      SELECT todos.*, targets.first_name, targets.last_name, targets.company as company_name 
      FROM todos 
      JOIN targets ON todos.target_id = targets.id 
      WHERE todos.id = ?
    `).get(id);

    return res.status(201).json(todo);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
