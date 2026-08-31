const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

const search = `                  let parsedConfig = { action_type: "enrich_email", provider_chain: ["prospeo", "apollo", "snov", "skrapp", "hunter", "lusha", "contactout"] };
                  try {
                    if (ws.config) parsedConfig = JSON.parse(ws.config);
                  } catch (e) {}`;

const replace = `                  let parsedConfig = { action_type: "enrich_email", provider_chain: ["prospeo", "apollo", "snov", "skrapp", "hunter", "lusha", "contactout"] };
                  try {
                    if (ws.config && ws.config !== "null") {
                      const p = JSON.parse(ws.config);
                      if (p && typeof p === "object") parsedConfig = p;
                    }
                  } catch (e) {}`;

code = code.replace(search, replace);
fs.writeFileSync('pages/workflows/[id].tsx', code);
