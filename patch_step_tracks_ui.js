const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

// 1. Update addWizardStep signature
code = code.replace(
  `async function addWizardStep(type: "visit" | "connect" | "message" | "sales_inmail" | "email" | "integration" | "change_status") {
    const track: Track = (type === "integration" || type === "change_status") ? "integration" : type === "email" ? "email" : "linkedin";`,
  `async function addWizardStep(type: "visit" | "connect" | "message" | "sales_inmail" | "email" | "integration" | "change_status", explicitTrack?: Track) {
    const track: Track = explicitTrack || (type === "integration" ? "integration" : type === "email" ? "email" : "linkedin");`
);

// 2. Update the buttons in the UI for ALL tracks to include change_status
const buttonsAnchor = `                      {track === "linkedin"
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
                            <>
                              <button onClick={() => addWizardStep("integration")}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary/70 hover:text-primary">
                                <RiAddLine size={11} /> {STEP_LABELS["integration"]}
                              </button>
                              <button onClick={() => addWizardStep("change_status")}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs border-secondary/20 bg-secondary/5 hover:bg-secondary/10 text-secondary/70 hover:text-secondary">
                                <RiAddLine size={11} /> {STEP_LABELS["change_status"]}
                              </button>
                            </>
                          )}`;

const buttonsReplace = `                      {track === "linkedin" ? (
                          <>
                            {(["visit", "connect", "message", "sales_inmail"] as const)
                              .filter((type) => type !== "sales_inmail" || hasPremium)
                              .map((type) => {
                              const disabled = type === "connect" && hasConnect;
                              return (
                                <button key={type} onClick={() => !disabled && addWizardStep(type, "linkedin")} title={disabled ? "Connection step can only be added once" : undefined}
                                  className={\`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs \${disabled ? "border-base-300/20 bg-base-200/40 text-base-content/20 cursor-not-allowed" : "border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary/70 hover:text-primary"}\`}>
                                  <RiAddLine size={11} /> {STEP_LABELS[type]}
                                </button>
                              );
                            })}
                            <button onClick={() => addWizardStep("change_status", "linkedin")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs border-secondary/20 bg-secondary/5 hover:bg-secondary/10 text-secondary/70 hover:text-secondary"><RiAddLine size={11} /> Change CRM Status</button>
                          </>
                        ) : track === "email" ? (
                          <>
                            <button onClick={() => addWizardStep("email", "email")}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs border-warning/20 bg-warning/5 hover:bg-warning/10 text-warning/70 hover:text-warning">
                              <RiAddLine size={11} /> {trackSteps.length === 0 ? "Cold Email" : \`Follow-up #\${trackSteps.length + 1}\`}
                            </button>
                            <button onClick={() => addWizardStep("change_status", "email")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs border-secondary/20 bg-secondary/5 hover:bg-secondary/10 text-secondary/70 hover:text-secondary"><RiAddLine size={11} /> Change CRM Status</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => addWizardStep("integration", "integration")}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary/70 hover:text-primary">
                              <RiAddLine size={11} /> {STEP_LABELS["integration"]}
                            </button>
                            <button onClick={() => addWizardStep("change_status", "integration")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs border-secondary/20 bg-secondary/5 hover:bg-secondary/10 text-secondary/70 hover:text-secondary"><RiAddLine size={11} /> Change CRM Status</button>
                          </>
                        )}`;

code = code.replace(buttonsAnchor, buttonsReplace);
fs.writeFileSync('pages/workflows/[id].tsx', code);
