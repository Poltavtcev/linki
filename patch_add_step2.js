const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

const anchor = `  async function addWizardStep(type: StepType) {`;
const replacement = `  async function addWizardStep(type: "visit" | "connect" | "message" | "sales_inmail" | "email" | "integration" | "change_status") {`;

code = code.replace(anchor, replacement);

// And default config for change_status!
const configAnchor = `config: type === "integration" ? JSON.stringify({ action_type: "enrich_email", provider_chain: ["prospeo", "apollo", "snov", "skrapp", "hunter", "lusha", "contactout"] }) : null };`;
const configReplace = `config: type === "integration" ? JSON.stringify({ action_type: "enrich_email", provider_chain: ["prospeo", "apollo", "snov", "skrapp", "hunter", "lusha", "contactout"] }) : type === "change_status" ? JSON.stringify({ status_id: "lead" }) : null };`;
code = code.replace(configAnchor, configReplace);

fs.writeFileSync('pages/workflows/[id].tsx', code);
