import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
import { syncEmailInbox } from "@/lib/email/inbox";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end();
  }

  const db = getDb();
  
  // Find all email accounts that have IMAP configured
  const accounts = db.prepare(`
    SELECT id FROM email_accounts WHERE imap_host IS NOT NULL
  `).all() as { id: string }[];

  let totalReplies = 0;
  let totalBounces = 0;
  let successAccounts = 0;
  let failedAccounts = 0;

  for (const acc of accounts) {
    try {
      const result = await syncEmailInbox(acc.id);
      totalReplies += result.replies;
      totalBounces += result.bounces;
      successAccounts++;
    } catch (e) {
      console.error(`[backfill] Failed sync for account ${acc.id}:`, e);
      failedAccounts++;
    }
  }

  return res.json({
    accountsSynced: successAccounts,
    accountsFailed: failedAccounts,
    newReplies: totalReplies,
    newBounces: totalBounces,
  });
}
