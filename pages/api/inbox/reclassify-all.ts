import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
import { premium } from "@/ee";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  // Only allow if AI features are present
  if (!premium?.replies) {
    return res.status(403).json({ error: "AI Premium feature not available." });
  }

  const db = getDb();
  
  // Find email replies that need classification (NULL json, or had an error)
  const rows = db.prepare(`
    SELECT id FROM email_replies 
    WHERE classification_json IS NULL OR classification_error IS NOT NULL
  `).all() as { id: string }[];

  let success = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      await premium.replies.classifyAndDispatch(row.id);
      
      // Verify if classification succeeded (we wrote it in step 1 to the DB)
      const check = db.prepare("SELECT classification_json, classification_error FROM email_replies WHERE id = ?").get(row.id) as any;
      if (check && check.classification_json && !check.classification_error) {
        success++;
      } else {
        failed++;
      }
    } catch (e) {
      console.error(`[reclassify] Failed for reply ${row.id}:`, e);
      failed++;
    }
  }

  return res.json({ 
    total: rows.length, 
    success, 
    failed 
  });
}
