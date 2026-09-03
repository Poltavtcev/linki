import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
import { executeEnrichmentWaterfall } from "@/lib/integrations/runner";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const db = getDb();
  const listId = req.query.id as string;

  const list = db.prepare("SELECT id FROM lists WHERE id = ?").get(listId);
  if (!list) return res.status(404).json({ error: "List not found" });

  const { target_ids } = req.body as { target_ids?: string[] };

  let targets: any[];
  if (target_ids && target_ids.length > 0) {
    const placeholders = target_ids.map(() => "?").join(",");
    targets = db.prepare(`
      SELECT t.*
      FROM targets t
      INNER JOIN list_targets lt ON lt.target_id = t.id
      WHERE lt.list_id = ? AND t.id IN (${placeholders}) AND t.email IS NULL
    `).all(listId, ...target_ids);
  } else {
    targets = db.prepare(`
      SELECT t.*
      FROM targets t
      INNER JOIN list_targets lt ON lt.target_id = t.id
      WHERE lt.list_id = ? AND t.apollo_enriched_at IS NULL AND t.email IS NULL
    `).all(listId);
  }

  let enriched = 0;
  let notFound = 0;
  let skipped = 0;

  const defaultChain = ["prospeo", "apollo", "snov", "skrapp", "hunter", "lusha", "contactout"];

  for (const target of targets) {
    try {
      db.prepare("UPDATE targets SET apollo_enriched_at = datetime('now') WHERE id = ?").run(target.id);
      
      const result = await executeEnrichmentWaterfall(db, target, defaultChain, "manual_ui");

      if (result.email) {
        enriched++;
      } else {
        notFound++;
      }
    } catch {
      skipped++;
    }
  }

  return res.json({ enriched, notFound, skipped, total: targets.length });
}

export const config = {
  api: { responseLimit: false },
};
