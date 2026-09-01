import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";

export const DEFAULT_CRM_STATUSES = [
  { id: "lead", label: "Lead", color: "bg-base-300", blocks_enrollment: false },
  { id: "outreach", label: "Outreach", color: "bg-info/20 text-info", blocks_enrollment: false },
  { id: "engaged", label: "Engaged", color: "bg-primary/20 text-primary", blocks_enrollment: false },
  { id: "meeting", label: "Meeting", color: "bg-warning/20 text-warning", blocks_enrollment: true },
  { id: "opportunity", label: "Opportunity", color: "bg-success/20 text-success", blocks_enrollment: true },
  { id: "customer", "label": "Customer", color: "bg-success text-success-content", blocks_enrollment: true },
  { id: "nurture", label: "Nurture", color: "bg-secondary/20 text-secondary", blocks_enrollment: false },
  { id: "disqualified", label: "Disqualified", color: "bg-error/20 text-error", blocks_enrollment: true }
];

export function getCrmStatuses() {
  const db = getDb();
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'crm_statuses'").get() as { value: string } | undefined;
  if (!row) return DEFAULT_CRM_STATUSES;
  try {
    return JSON.parse(row.value);
  } catch {
    return DEFAULT_CRM_STATUSES;
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = getDb();

  if (req.method === "GET") {
    return res.json(getCrmStatuses());
  }

  if (req.method === "PUT") {
    const statuses = req.body;
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('crm_statuses', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(statuses));
    return res.json({ ok: true });
  }

  res.status(405).end();
}
