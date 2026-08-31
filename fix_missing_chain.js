const fs = require('fs');
let code = fs.readFileSync('lib/integrations/runner.ts', 'utf8');

const anchor = `  if (config.action_type === "enrich_email") {
    log(db, runId, target.id, "info", \`Starting Enrichment Waterfall: \${(config.provider_chain || []).join(" -> ") || "No providers selected"}\`);
    const chain = config.provider_chain || [];`;

const replacement = `  if (config.action_type === "enrich_email") {
    const chain = (config.provider_chain && config.provider_chain.length > 0) ? config.provider_chain : ["prospeo", "apollo", "snov", "skrapp", "hunter", "lusha", "contactout"];
    log(db, runId, target.id, "info", \`Starting Enrichment Waterfall: \${chain.join(" -> ")}\`);`;

code = code.replace(anchor, replacement);
fs.writeFileSync('lib/integrations/runner.ts', code);
