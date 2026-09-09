import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
import { tickActions } from "@/lib/linkedin/runner";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  const isValidCron = process.env.INTERNAL_API_SECRET && req.headers.authorization === `Bearer ${process.env.INTERNAL_API_SECRET}`;

  if (!session && !isValidCron) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const db = getDb();
    await tickActions(db);
    res.json({ ok: true });
  } catch(e) {
    console.error("[CRON ERROR]", e);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
