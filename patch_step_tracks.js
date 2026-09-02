const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

// LinkedIn Track Buttons
const liAnchor = `                              <button key={type} onClick={() => !disabled && addWizardStep(type)} title={disabled ? "Connection step can only be added once" : undefined}
                                className={\`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs \${disabled ? "border-base-300/20 bg-base-200/40 text-base-content/20 cursor-not-allowed" : "border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary/70 hover:text-primary"}\`}>
                                <RiAddLine size={11} /> {STEP_LABELS[type]}
                              </button>
                            );
                          })
                        : track === "email" ? (`;

const liReplace = `                              <button key={type} onClick={() => !disabled && addWizardStep(type)} title={disabled ? "Connection step can only be added once" : undefined}
                                className={\`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs \${disabled ? "border-base-300/20 bg-base-200/40 text-base-content/20 cursor-not-allowed" : "border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary/70 hover:text-primary"}\`}>
                                <RiAddLine size={11} /> {STEP_LABELS[type]}
                              </button>
                            );
                          })}
                          <button onClick={() => addWizardStep("change_status", "linkedin")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-xs border-secondary/20 bg-secondary/5 hover:bg-secondary/10 text-secondary/70 hover:text-secondary">
                            <RiAddLine size={11} /> Change CRM Status
                          </button>
                        </>
                        : track === "email" ? (`;

code = code.replace(liAnchor, liReplace);
// Note: Wait, map() is returning an array of JSX. I need to wrap it in a React fragment <> if I append a button.
// Let's rewrite the replacement carefully.
