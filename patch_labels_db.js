const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

const replacement = `
function getStepLabel(type: string, configStr?: string | null): string {
  if (type === "integration") {
    try {
      if (configStr && configStr !== "null") {
        const p = JSON.parse(configStr);
        if (p.action_type === "push_to_hubspot") return "HubSpot Sync";
        if (p.action_type === "enrich_email") return "Email Enrichment";
      }
    } catch(e) {}
    return "Integration";
  }
  return STEP_LABELS[type] ?? type;
}

function getDynamicStepLabel(ws: any, wizardSteps: Array<any>, idx: number): string {
  if (ws.type === "email") return getEmailStepLabel(wizardSteps, idx);
  if (ws.type === "message") return getMessageStepLabel(wizardSteps, idx);
  return getStepLabel(ws.type, ws.config);
}`;

code = code.replace(/function getDynamicStepLabel[\s\S]*?return STEP_LABELS\[ws\.type\] \?\? ws\.type;\n}/, replacement.trim());

// Replace usages in DB fetched rendering
code = code.replace(/{STEP_LABELS\[s\.step_type\] \?\? s\.step_type}/g, '{getStepLabel(s.step_type, s.config)}');
// Note: for the table list rendering we might not have the config if it's just 'st' in the 'run_profile_tracks' view,
// but let's check line 3552: "st ? (STEP_LABELS[st] ?? st) : '—'". 
// In the prospects table, we only know the step_type from the currently active step. We don't have the step config. So STEP_LABELS[st] is fine for that fallback.

fs.writeFileSync('pages/workflows/[id].tsx', code);
