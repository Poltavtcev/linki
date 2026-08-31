const fs = require('fs');
let code = fs.readFileSync('lib/integrations/runner.ts', 'utf8');

const anchor = `  let config;
  try {
    config = JSON.parse(step.config);
  } catch (e) {
    log(db, runId, target.id, "error", \`Failed to parse integration config: \${(e as Error).message}\`);
    trAdvance(db, tr, steps);
    return;
  }

  if (config.action_type === "enrich_email") {`;

const replacement = `  let config = { action_type: "enrich_email", provider_chain: [] as string[] };
  try {
    if (step.config && step.config !== "null") {
      const parsed = JSON.parse(step.config);
      if (parsed && typeof parsed === "object") {
        config = parsed;
      }
    }
  } catch (e) {
    log(db, runId, target.id, "error", \`Failed to parse integration config: \${(e as Error).message}\`);
    trAdvance(db, tr, steps);
    return;
  }

  if (config.action_type === "enrich_email") {`;

code = code.replace(anchor, replacement);
fs.writeFileSync('lib/integrations/runner.ts', code);
