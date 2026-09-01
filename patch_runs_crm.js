const fs = require('fs');
let code = fs.readFileSync('pages/api/runs/index.ts', 'utf8');

if (!code.includes("getCrmStatuses")) {
  code = code.replace(
    `import { randomUUID } from "crypto";`,
    `import { randomUUID } from "crypto";\nimport { getCrmStatuses } from "./../settings/crm-statuses";`
  );
  
  const anchor = `    // Exclude targets with protected lead_status (CRM feature)
    const crmExcluded = new Set(
      (db.prepare(
        "SELECT id as target_id FROM targets WHERE lead_status IN ('meeting_scheduled', 'customer', 'disqualified')"
      ).all() as { target_id: string }[]).map((r) => r.target_id)
    );`;
    
  const replacement = `    // Exclude targets with protected lead_status (CRM feature)
    const crmStatuses = getCrmStatuses();
    const blockedStatuses = crmStatuses.filter((s: any) => s.blocks_enrollment).map((s: any) => s.id);
    const crmExcluded = new Set(
      blockedStatuses.length > 0 
        ? (db.prepare(
            \`SELECT id as target_id FROM targets WHERE lead_status IN (\${blockedStatuses.map(() => '?').join(',')})\`
          ).all(...blockedStatuses) as { target_id: string }[]).map((r) => r.target_id)
        : []
    );`;
    
  code = code.replace(anchor, replacement);
  fs.writeFileSync('pages/api/runs/index.ts', code);
}
