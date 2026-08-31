const fs = require('fs');
let code = fs.readFileSync('lib/integrations/runner.ts', 'utf8');

const anchor = `  let config = { action_type: "enrich_email", provider_chain: [] as string[] };`;
const replacement = `  let config = { action_type: "enrich_email", provider_chain: ["prospeo", "apollo", "snov", "skrapp", "hunter", "lusha", "contactout"] as string[] };`;

code = code.replace(anchor, replacement);
fs.writeFileSync('lib/integrations/runner.ts', code);
