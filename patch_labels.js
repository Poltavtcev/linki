const fs = require('fs');

let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

// Add change_status to STEP_LABELS
code = code.replace(
  'integration: "Integration",',
  'integration: "Integration",\n  change_status: "Change CRM Status",'
);

// Add getDynamicStepLabel function
const anchor = `  return \`LinkedIn Follow-up \${ordinals[msgPos] ?? \`#\${msgPos + 1}\`}\`;\n}`;
const getDynamicCode = `

function getDynamicStepLabel(ws: any, wizardSteps: Array<any>, idx: number): string {
  if (ws.type === "email") return getEmailStepLabel(wizardSteps, idx);
  if (ws.type === "message") return getMessageStepLabel(wizardSteps, idx);
  if (ws.type === "integration") {
    try {
      if (ws.config && ws.config !== "null") {
        const p = JSON.parse(ws.config);
        if (p.action_type === "push_to_hubspot") return "HubSpot Sync";
        if (p.action_type === "enrich_email") return "Email Enrichment";
      }
    } catch(e) {}
    return "Integration";
  }
  return STEP_LABELS[ws.type] ?? ws.type;
}`;

code = code.replace(anchor, anchor + getDynamicCode);

// Replace all occurrences
code = code.replace(/ws\.type === "email" \? getEmailStepLabel\(wizardSteps, idx\) : ws\.type === "message" \? getMessageStepLabel\(wizardSteps, idx\) : STEP_LABELS\[ws\.type\]/g, 'getDynamicStepLabel(ws, wizardSteps, idx)');
code = code.replace(/ws\.type === "email" \? getEmailStepLabel\(wizardSteps, i\) : ws\.type === "message" \? getMessageStepLabel\(wizardSteps, i\) : STEP_LABELS\[ws\.type\]/g, 'getDynamicStepLabel(ws, wizardSteps, i)');
code = code.replace(/ws\.type === "email" \? getEmailStepLabel\(wizardSteps, i\) : getMessageStepLabel\(wizardSteps, i\)/g, 'getDynamicStepLabel(ws, wizardSteps, i)');

fs.writeFileSync('pages/workflows/[id].tsx', code);
