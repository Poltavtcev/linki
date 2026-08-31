const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

// 1. Update Track and WizardPage types
code = code.replace(/type Track = "linkedin" \| "email";/, 'type Track = "linkedin" | "email" | "integration";');
code = code.replace(/type WizardPage = "prospects" \| "prompt" \| "linkedin-steps" \| "email-steps" \| "account" \| "summary";/, 'type WizardPage = "prospects" | "prompt" | "linkedin-steps" | "email-steps" | "integration-steps" | "account" | "summary";');

// 2. Add tab to UI
const oldTabs = `          <button onClick={() => setPage("linkedin-steps")} className={\`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors relative -mb-px border-b-2 \${p === "linkedin-steps" ? "border-primary text-primary" : "border-transparent text-base-content/50 hover:text-base-content/80"}\`}>
            <RiLinkedinBoxLine size={16} /> LinkedIn Steps
          </button>
          <button onClick={() => setPage("email-steps")} className={\`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors relative -mb-px border-b-2 \${p === "email-steps" ? "border-primary text-primary" : "border-transparent text-base-content/50 hover:text-base-content/80"}\`}>
            <RiMailLine size={16} /> Email Steps
          </button>`;

const newTabs = `          <button onClick={() => setPage("linkedin-steps")} className={\`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors relative -mb-px border-b-2 \${p === "linkedin-steps" ? "border-primary text-primary" : "border-transparent text-base-content/50 hover:text-base-content/80"}\`}>
            <RiLinkedinBoxLine size={16} /> LinkedIn Steps
          </button>
          <button onClick={() => setPage("email-steps")} className={\`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors relative -mb-px border-b-2 \${p === "email-steps" ? "border-primary text-primary" : "border-transparent text-base-content/50 hover:text-base-content/80"}\`}>
            <RiMailLine size={16} /> Email Steps
          </button>
          <button onClick={() => setPage("integration-steps")} className={\`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors relative -mb-px border-b-2 \${p === "integration-steps" ? "border-primary text-primary" : "border-transparent text-base-content/50 hover:text-base-content/80"}\`}>
            <RiPlugLine size={16} /> Integration Steps
          </button>`;
          
code = code.replace(oldTabs, newTabs);

// 3. Render the Integration steps page
const oldPageRender = `                {(p === "linkedin-steps" || p === "email-steps") && (
                  <div className="space-y-4">
                    {(() => {
                      const track = p === "linkedin-steps" ? "linkedin" : "email";
                      const trackSteps = wizardSteps.map((ws, idx) => ({ ws, idx })).filter(({ ws }) => ws.track === track);`;

const newPageRender = `                {(p === "linkedin-steps" || p === "email-steps" || p === "integration-steps") && (
                  <div className="space-y-4">
                    {(() => {
                      const track = p === "linkedin-steps" ? "linkedin" : p === "email-steps" ? "email" : "integration";
                      const trackSteps = wizardSteps.map((ws, idx) => ({ ws, idx })).filter(({ ws }) => ws.track === track);`;

code = code.replace(oldPageRender, newPageRender);

// 4. Update the "Add step" logic for the integration track
const oldAddStep = `                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-base-content/30 mr-1">Add step:</span>
                      {track === "linkedin"
                        ? (["visit", "connect", "message", "sales_inmail", "integration"] as const)
                            // Sales Nav InMail is a premium feature — hide from the picker in the public build.
                            .filter((type) => type !== "sales_inmail" || hasPremium)
                            .map((type) => {
                            const disabled = type === "connect" && hasConnect;
                            return (
                              <button key={type} onClick={() => !disabled && addWizardStep(type)} title={disabled ? "Connection step can only be added once" : undefined}
                                className={\`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs \${disabled ? "border-base-300/20 bg-base-200/40 text-base-content/20 cursor-not-allowed" : "border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary/70 hover:text-primary"}\`}>
                                <RiAddLine size={11} /> {STEP_LABELS[type]}
                              </button>
                            );
                          })
                        : (
                            <>
                            <button onClick={() => addWizardStep("email")}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs border-warning/20 bg-warning/5 hover:bg-warning/10 text-warning/70 hover:text-warning">
                              <RiAddLine size={11} /> {trackSteps.length === 0 ? "Cold Email" : \`Follow-up #\${trackSteps.length + 1}\`}
                            </button>
                            <button onClick={() => addWizardStep("integration")}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs border-accent/20 bg-accent/5 hover:bg-accent/10 text-accent/70 hover:text-accent">
                              <RiAddLine size={11} /> Integration
                            </button>
                            </>
                          )}
                    </div>`;

const newAddStep = `                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-base-content/30 mr-1">Add step:</span>
                      {track === "linkedin"
                        ? (["visit", "connect", "message", "sales_inmail"] as const)
                            .filter((type) => type !== "sales_inmail" || hasPremium)
                            .map((type) => {
                            const disabled = type === "connect" && hasConnect;
                            return (
                              <button key={type} onClick={() => !disabled && addWizardStep(type)} title={disabled ? "Connection step can only be added once" : undefined}
                                className={\`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs \${disabled ? "border-base-300/20 bg-base-200/40 text-base-content/20 cursor-not-allowed" : "border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary/70 hover:text-primary"}\`}>
                                <RiAddLine size={11} /> {STEP_LABELS[type]}
                              </button>
                            );
                          })
                        : track === "email" ? (
                            <button onClick={() => addWizardStep("email")}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs border-warning/20 bg-warning/5 hover:bg-warning/10 text-warning/70 hover:text-warning">
                              <RiAddLine size={11} /> {trackSteps.length === 0 ? "Cold Email" : \`Follow-up #\${trackSteps.length + 1}\`}
                            </button>
                          )
                        : (
                            <button onClick={() => addWizardStep("integration")}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs border-accent/20 bg-accent/5 hover:bg-accent/10 text-accent/70 hover:text-accent">
                              <RiAddLine size={11} /> Integration Step
                            </button>
                          )}
                    </div>`;

code = code.replace(oldAddStep, newAddStep);

// 5. Update addWizardStep to correctly use current tab's track
const oldAddWizard = `const track: Track = type === "email" ? "email" : "linkedin";`;
const newAddWizard = `const track: Track = type === "integration" ? "integration" : type === "email" ? "email" : "linkedin";`;
code = code.replace(oldAddWizard, newAddWizard);

// 6. Fix mapping over tracks in Summary
const oldSummary = `              {(["linkedin", "email"] as Track[]).map((track) => {`;
const newSummary = `              {(["linkedin", "email", "integration"] as Track[]).map((track) => {`;
code = code.replace(oldSummary, newSummary);

fs.writeFileSync('pages/workflows/[id].tsx', code);
