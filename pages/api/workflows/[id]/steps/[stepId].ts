import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = getDb();
  const stepId = req.query.stepId as string;

  if (req.method === "PUT") {
    const { step_type, template_id, delay_seconds, step_order, connect_note, message_body, email_subject, email_body, edges_json, ai_qualification_rules, ai_comment_prompt } = req.body;
    db.prepare(
      `UPDATE workflow_steps SET
        step_type = COALESCE(?, step_type),
        template_id = COALESCE(?, template_id),
        delay_seconds = COALESCE(?, delay_seconds),
        step_order = COALESCE(?, step_order),
        connect_note = ?,
        message_body = ?,
        email_subject = ?,
        email_body = ?,
        edges_json = COALESCE(?, edges_json),
        ai_qualification_rules = COALESCE(?, ai_qualification_rules),
        ai_comment_prompt = COALESCE(?, ai_comment_prompt)
       WHERE id = ?`
    ).run(step_type ?? null, template_id ?? null, delay_seconds ?? null, step_order ?? null, connect_note !== undefined ? connect_note : null, message_body !== undefined ? message_body : null, email_subject !== undefined ? email_subject : null, email_body !== undefined ? email_body : null, edges_json ?? null, ai_qualification_rules ?? null, ai_comment_prompt ?? null, stepId);
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    db.prepare("DELETE FROM workflow_steps WHERE id = ?").run(stepId);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
