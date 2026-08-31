const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

const oldCode = `                  {p === "email-steps" && wizardSteps.filter(s => s.track === "email").length > 0 && (
                    <p className="text-xs text-base-content/40">{wizardSteps.filter(s => s.track === "email").length} step{wizardSteps.filter(s => s.track === "email").length !== 1 ? "s" : ""}</p>
                  )}`;

const newCode = `                  {p === "email-steps" && wizardSteps.filter(s => s.track === "email").length > 0 && (
                    <p className="text-xs text-base-content/40">{wizardSteps.filter(s => s.track === "email").length} step{wizardSteps.filter(s => s.track === "email").length !== 1 ? "s" : ""}</p>
                  )}
                  {p === "integration-steps" && wizardSteps.filter(s => s.track === "integration").length > 0 && (
                    <p className="text-xs text-base-content/40">{wizardSteps.filter(s => s.track === "integration").length} step{wizardSteps.filter(s => s.track === "integration").length !== 1 ? "s" : ""}</p>
                  )}`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('pages/workflows/[id].tsx', code);
