import type { NextApiRequest, NextApiResponse } from "next";
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";
import { getCrmStatuses } from "./../settings/crm-statuses";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = getDb();

  if (req.method === "GET") {
    const runs = db
      .prepare(
        `SELECT r.*,
                w.name as workflow_name,
                l.name as list_name,
                a.name as account_name,
                COUNT(DISTINCT rp.id) as total_profiles,
                COUNT(DISTINCT CASE WHEN NOT EXISTS (
                  SELECT 1 FROM run_profile_tracks rt2
                  WHERE rt2.run_profile_id = rp.id AND rt2.state NOT IN ('completed', 'failed', 'skipped')
                ) AND EXISTS (
                  SELECT 1 FROM run_profile_tracks rt3
                  WHERE rt3.run_profile_id = rp.id AND rt3.state = 'completed'
                ) THEN rp.id END) as completed_profiles
         FROM runs r
         LEFT JOIN workflows w ON w.id = r.workflow_id
         LEFT JOIN lists l ON l.id = r.list_id
         LEFT JOIN accounts a ON a.id = r.account_id
         LEFT JOIN run_profiles rp ON rp.run_id = r.id
         GROUP BY r.id
         ORDER BY r.created_at DESC`
      )
      .all();
    return res.json(runs);
  }

  if (req.method === "POST") {
    const { workflow_id, list_id, account_id, email_account_id, email_account_ids, target_ids } = req.body;
    if (!workflow_id || !list_id || !account_id)
      return res.status(400).json({ error: "workflow_id, list_id, account_id required" });

    // Normalise email account list — prefer the new array, fall back to legacy single-id
    const emailAccountPool: string[] = Array.isArray(email_account_ids) && email_account_ids.length > 0
      ? email_account_ids
      : (email_account_id ? [email_account_id] : []);

    // Check 1: only one active run per workflow
    const activeRun = db.prepare(
      "SELECT id FROM runs WHERE workflow_id = ? AND status IN ('running', 'paused') LIMIT 1"
    ).get(workflow_id) as { id: string } | undefined;
    if (activeRun) {
      return res.status(400).json({
        error: "workflow_already_active",
        message: "This workflow is already running. Stop or pause it before enrolling a new list.",
      });
    }

    const runId = randomUUID();
    // For backwards compat, store first email account on the run row (may be null for no-email campaigns)
    db
      .prepare("INSERT INTO runs (id, workflow_id, list_id, account_id, email_account_id) VALUES (?, ?, ?, ?, ?)")
      .run(runId, workflow_id, list_id, account_id, emailAccountPool[0] ?? null);

    // Create run_profiles — either for selected targets or all targets in the list
    const candidates: { target_id: string }[] = Array.isArray(target_ids) && target_ids.length > 0
      ? (target_ids as string[]).map((id) => ({ target_id: id }))
      : db.prepare("SELECT target_id FROM list_targets WHERE list_id = ?").all(list_id) as { target_id: string }[];

    // Exclude targets already enrolled in any run of this workflow
    const alreadyEnrolled = new Set(
      (db.prepare(
        `SELECT DISTINCT rp.target_id FROM run_profiles rp
         JOIN runs r ON r.id = rp.run_id
         WHERE r.workflow_id = ?`
      ).all(workflow_id) as { target_id: string }[]).map((r) => r.target_id)
    );

    // Exclude targets currently active in any other running/paused workflow
    const activeElsewhere = new Set(
      (db.prepare(
        `SELECT DISTINCT rp.target_id FROM run_profiles rp
         JOIN runs r ON r.id = rp.run_id
         WHERE r.status IN ('running', 'paused')
         AND EXISTS (
           SELECT 1 FROM run_profile_tracks rt
           WHERE rt.run_profile_id = rp.id AND rt.state NOT IN ('completed', 'failed', 'skipped')
         )`
      ).all() as { target_id: string }[]).map((r) => r.target_id)
    );

    // Exclude targets with protected lead_status (CRM feature)
    const crmStatuses = getCrmStatuses();
    const blockedStatuses = crmStatuses.filter((s: any) => s.blocks_enrollment).map((s: any) => s.id);
    const crmExcluded = new Set(
      blockedStatuses.length > 0 
        ? (db.prepare(
            `SELECT id as target_id FROM targets WHERE lead_status IN (${blockedStatuses.map(() => '?').join(',')})`
          ).all(...blockedStatuses) as { target_id: string }[]).map((r) => r.target_id)
        : []
    );

    // Cross-campaign overlap logic
    const workflow = db.prepare("SELECT allow_cross_campaign_overlap FROM workflows WHERE id = ?").get(workflow_id) as { allow_cross_campaign_overlap: number } | undefined;
    const overlapAllowed = workflow?.allow_cross_campaign_overlap === 1;

    let overlapExcluded = new Set<string>();
    if (!overlapAllowed) {
      overlapExcluded = new Set(
        (db.prepare(
          `SELECT DISTINCT rp.target_id FROM run_profiles rp
           JOIN runs r ON r.id = rp.run_id
           WHERE r.workflow_id != ?`
        ).all(workflow_id) as { target_id: string }[]).map((r) => r.target_id)
      );
    }

    const targets = candidates.filter((t) => 
      !alreadyEnrolled.has(t.target_id) && 
      !activeElsewhere.has(t.target_id) && 
      !crmExcluded.has(t.target_id) &&
      !overlapExcluded.has(t.target_id)
    );

    if (targets.length === 0) {
      // Clean up the run we just created since there's nothing to enroll
      db.prepare("DELETE FROM runs WHERE id = ?").run(runId);
      return res.status(400).json({
        error: "all_already_enrolled",
        message: "All selected contacts are already enrolled in this workflow.",
      });
    }

    // Assign email accounts: company-grouped round-robin
    // All targets at the same company get the same sender; companies cycle through the pool
    let emailAssignment: Map<string, string | null> = new Map();
    if (emailAccountPool.length > 0) {
      // Load company_id for each candidate target
      const targetIds = targets.map(t => t.target_id);
      const placeholders = targetIds.map(() => "?").join(",");
      const companyRows = db.prepare(
        `SELECT id, company_id FROM targets WHERE id IN (${placeholders})`
      ).all(...targetIds) as { id: string; company_id: string | null }[];

      const companyAccountMap = new Map<string, string>(); // company_id → email_account_id
      let poolCursor = 0;

      for (const row of companyRows) {
        if (row.company_id) {
          if (!companyAccountMap.has(row.company_id)) {
            companyAccountMap.set(row.company_id, emailAccountPool[poolCursor % emailAccountPool.length]);
            poolCursor++;
          }
          emailAssignment.set(row.id, companyAccountMap.get(row.company_id)!);
        } else {
          // No company — assign individually round-robin
          emailAssignment.set(row.id, emailAccountPool[poolCursor % emailAccountPool.length]);
          poolCursor++;
        }
      }
    }

    // DAG ENGINE INIT
    // Find the root step (the one with the lowest step_order)
    const rootStepRow = db.prepare("SELECT id FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order ASC LIMIT 1").get(workflow_id) as { id: string } | undefined;
    const rootStepId = rootStepRow ? rootStepRow.id : null;

    const insertProfile = db.prepare(
      "INSERT INTO run_profiles (id, run_id, target_id, email_account_id) VALUES (?, ?, ?, ?)"
    );
    const insertState = db.prepare(
      "INSERT INTO run_profile_states (run_profile_id, current_step_id, state) VALUES (?, ?, 'pending')"
    );
    
    // Also insert into run_profile_tracks for backwards compatibility in UI until UI is fully migrated
    const insertTrack = db.prepare(
      "INSERT INTO run_profile_tracks (id, run_profile_id, track, state, current_step) VALUES (?, ?, 'linkedin', 'pending', 0)"
    );

    const insertMany = db.transaction((ts: { target_id: string }[]) => {
      for (const t of ts) {
        const assignedEmailAccountId = emailAssignment.get(t.target_id) ?? null;
        const rpId = randomUUID();
        insertProfile.run(rpId, runId, t.target_id, assignedEmailAccountId);
        if (rootStepId) {
          insertState.run(rpId, rootStepId);
        }
        insertTrack.run(randomUUID(), rpId);
      }
    });
    insertMany(targets);

    return res.status(201).json({ id: runId });
  }

  res.status(405).end();
}
