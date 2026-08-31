const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

// 1. Add 'integration' to STEP_LABELS
code = code.replace(/email: "Cold Email",\n\};/, 'email: "Cold Email",\n  integration: "Integration",\n};');

// 2. Add to the picker
const oldEmailPicker = `<button onClick={() => addWizardStep("email")}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs border-warning/20 bg-warning/5 hover:bg-warning/10 text-warning/70 hover:text-warning">
                              <RiAddLine size={11} /> {trackSteps.length === 0 ? "Cold Email" : \`Follow-up #\${trackSteps.length + 1}\`}
                            </button>`;

const newEmailPicker = `<button onClick={() => addWizardStep("email")}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs border-warning/20 bg-warning/5 hover:bg-warning/10 text-warning/70 hover:text-warning">
                              <RiAddLine size={11} /> {trackSteps.length === 0 ? "Cold Email" : \`Follow-up #\${trackSteps.length + 1}\`}
                            </button>
                            <button onClick={() => addWizardStep("integration")}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs border-accent/20 bg-accent/5 hover:bg-accent/10 text-accent/70 hover:text-accent">
                              <RiAddLine size={11} /> Integration
                            </button>`;

code = code.replace(oldEmailPicker, newEmailPicker);

// 3. Update the initialization of the step when 'integration' is added
// In the create step endpoint API call or the local state
// Wait, addWizardStep creates the step by POSTing to /api/workflows/${workflow.id}/steps
// It doesn't need client-side default values beyond what the API handles, except maybe rendering.

fs.writeFileSync('pages/workflows/[id].tsx', code);
