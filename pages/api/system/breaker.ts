import { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
import { isBreakerTripped, resetBreaker } from "@/lib/linkedin/circuit-breaker";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
     const tripped = isBreakerTripped();
     if (!tripped) return res.json({ tripped: false });
     
     const db = getDb();
     const setting = db.prepare("SELECT value FROM app_settings WHERE key = 'li_circuit_breaker'").get() as { value: string };
     return res.json({ tripped: true, data: JSON.parse(setting.value) });
  } else if (req.method === "POST") {
     resetBreaker();
     return res.json({ success: true });
  }
  res.status(405).end();
}
