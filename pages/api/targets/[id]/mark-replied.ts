import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
import { premium } from "@/lib/premium";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const db = getDb();
  const targetId = req.query.id as string;
  const { channel, text } = req.body as { channel?: "linkedin" | "email"; text?: string };

  const target = db.prepare("SELECT id FROM targets WHERE id = ?").get(targetId);
  if (!target) return res.status(404).json({ error: "Target not found" });

  const resolvedChannel = channel === "email" ? "email" : "linkedin";

  // Check if Premium / AI adapter is available
  if (premium) {
    // Dynamically require ee/index to access the exported processReply function.
    // premium just exports the default export, but we need the named export `processReply`.
    try {
      const ee = require("@/ee");
      if (typeof ee.processReply === "function") {
        await ee.processReply(targetId, resolvedChannel, text);
        return res.json({ ok: true });
      }
    } catch (e) {
      console.warn("Failed to invoke unified processReply, falling back to deterministic stop", e);
    }
  }

  // Fallback if ee/ is not installed or processReply failed
  const now = new Date().toISOString();
  if (resolvedChannel === "email") {
    db.prepare("UPDATE targets SET email_replied_at = COALESCE(email_replied_at, ?) WHERE id = ?").run(now, targetId);
  } else {
    db.prepare("UPDATE targets SET last_replied_at = COALESCE(last_replied_at, ?) WHERE id = ?").run(now, targetId);
  }

  return res.json({ ok: true });
}
