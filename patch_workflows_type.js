const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

code = code.replace(/type StepType = "visit" \| "connect" \| "message" \| "sales_inmail" \| "delay" \| "email";/, 'type StepType = "visit" | "connect" | "message" | "sales_inmail" | "delay" | "email" | "integration";');

// Also update the UI to allow adding an integration step
// We need to find where steps are rendered or added.
fs.writeFileSync('pages/workflows/[id].tsx', code);
