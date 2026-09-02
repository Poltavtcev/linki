const fs = require('fs');

let code = fs.readFileSync('lib/csv-import.ts', 'utf8');

const hook = `function get(row: Record<string, string>, key: string): string | null {`;

const smartLogic = `function resolveCrmStatus(db: DB, rawStatus: string): string | null {
  const s = rawStatus.trim().toLowerCase();
  if (!s) return null;
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'crm_statuses'").get() as { value: string } | undefined;
  
  let statuses = [
    { id: "lead", label: "Lead" },
    { id: "outreach", label: "Outreach" },
    { id: "engaged", label: "Engaged" },
    { id: "meeting", label: "Meeting" },
    { id: "opportunity", label: "Opportunity" },
    { id: "customer", label: "Customer" },
    { id: "nurture", label: "Nurture" },
    { id: "disqualified", label: "Disqualified" }
  ];
  if (row) {
    try { statuses = JSON.parse(row.value); } catch(e) {}
  }
  
  const match = statuses.find(st => st.id === s || st.label.toLowerCase() === s);
  return match ? match.id : null;
}

function get(row: Record<string, string>, key: string): string | null {`;

code = code.replace(hook, smartLogic);

const fieldsLogicOld = `const fields = Object.fromEntries(EDITABLE_FIELDS.map((f) => [f, get(raw, f)])) as Record<EditableField, string | null>;`;
const fieldsLogicNew = `const fields = Object.fromEntries(EDITABLE_FIELDS.map((f) => [f, get(raw, f)])) as Record<EditableField, string | null>;
    if (fields.lead_status) {
      const resolved = resolveCrmStatus(db, fields.lead_status);
      if (resolved) fields.lead_status = resolved;
    }`;

code = code.replace(fieldsLogicOld, fieldsLogicNew);

fs.writeFileSync('lib/csv-import.ts', code);
