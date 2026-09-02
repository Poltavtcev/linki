const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

const anchor = `                        : (
                            <button onClick={() => addWizardStep("integration")}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs border-accent/20 bg-accent/5 hover:bg-accent/10 text-accent/70 hover:text-accent">
                              <RiAddLine size={11} /> Integration Step
                            </button>
                          )}`;

const replacement = `                        : (
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

code = code.replace(anchor, replacement);
fs.writeFileSync('pages/workflows/[id].tsx', code);
