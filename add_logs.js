const fs = require('fs');
let code = fs.readFileSync('lib/integrations/runner.ts', 'utf8');

// Add start logs
code = code.replace(
  /if \(config.action_type === "enrich_email"\) \{/,
  `if (config.action_type === "enrich_email") {\n    log(db, runId, target.id, "info", \`Starting Enrichment Waterfall: \${(config.provider_chain || []).join(" -> ") || "No providers selected"}\`);`
);

code = code.replace(
  /for \(const provider of chain\) \{/,
  `for (const provider of chain) {\n      log(db, runId, target.id, "info", \`Checking provider: \${provider}...\`);`
);

code = code.replace(
  /if \(!row \|\| !row.api_key\) continue;/,
  `if (!row || !row.api_key) {\n        log(db, runId, target.id, "warn", \`Skipping \${provider} - API key is missing or inactive\`);\n        continue;\n      }`
);

// HubSpot logs
code = code.replace(
  /if \(config.action_type === "push_to_hubspot"\) \{/,
  `if (config.action_type === "push_to_hubspot") {\n    log(db, runId, target.id, "info", \`Starting push to HubSpot...\`);`
);

code = code.replace(
  /log\(db, runId, target\.id, "info", \`Successfully pushed to HubSpot\`\);/,
  `log(db, runId, target.id, "info", \`Successfully pushed \${target.first_name || ""} \${target.last_name || ""} to HubSpot CRM\`);`
);

// Not found log
code = code.replace(
  /break; \/\/ break the waterfall loop\n        \}\n      \} catch \(err: any\) \{/g,
  `break; // break the waterfall loop\n        }\n        \n        log(db, runId, target.id, "info", \`Provider \${provider} did not find an email\`);\n      } catch (err: any) {`
);

code = code.replace(
  /if \(err\.response\?\.status === 402 \|\| err\.response\?\.status === 429\) \{/g,
  `log(db, runId, target.id, "warn", \`\${provider} enrichment failed: \${err.message}\`);\n        if (err.response?.status === 402 || err.response?.status === 429) {`
);

// We need to add "No email found across all providers"
code = code.replace(
  /      \}\n    \}\n    \n  \} else if \(config\.action_type === "push_to_hubspot"\)/,
  `      }\n    }\n    if (!foundEmail) log(db, runId, target.id, "warn", \`Enrichment Waterfall finished. No email found across all \${chain.length} providers.\`);\n  } else if (config.action_type === "push_to_hubspot")`
);

fs.writeFileSync('lib/integrations/runner.ts', code);
