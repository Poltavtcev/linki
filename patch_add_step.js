const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

const anchor = `  async function addWizardStep(type: "visit" | "connect" | "message" | "sales_inmail" | "email" | "integration") {
    const track: Track = type === "integration" ? "integration" : type === "email" ? "email" : "linkedin";`;

const replacement = `  async function addWizardStep(type: StepType) {
    const track: Track = (type === "integration" || type === "change_status") ? "integration" : type === "email" ? "email" : "linkedin";`;

code = code.replace(anchor, replacement);
fs.writeFileSync('pages/workflows/[id].tsx', code);
