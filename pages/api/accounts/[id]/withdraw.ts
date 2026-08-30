import { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
import { withdrawOldInvitations } from "@/lib/linkedin/withdraw";
import { getSessionPage } from "@/lib/linkedin/session";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { id } = req.query;
  const { olderThanDays } = req.body;
  console.log("[withdraw] API hit:", { id, olderThanDays });
  
  if (typeof id !== "string") return res.status(400).json({ error: "Invalid ID" });
  if (typeof olderThanDays !== "number") {
    console.error("[withdraw] Invalid days:", olderThanDays);
    return res.status(400).json({ error: "Invalid days" });
  }
  
  const db = getDb();
  
  // Update the setting so it stays automated
  db.prepare("UPDATE accounts SET withdraw_invites_after_days = ? WHERE id = ?").run(olderThanDays, id);
  
  // Kick off a background job right now
  void (async () => {
    try {
      const page = await getSessionPage(id);
      await withdrawOldInvitations(page, id, olderThanDays, null);
      await page.close();
    } catch (e) {
      console.error("[withdraw] Manual trigger failed:", e);
    }
  })();
  
  return res.json({ started: true });
}
