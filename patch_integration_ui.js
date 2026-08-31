const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

const oldPanel = `{ws.type === "integration" && (
                  <div className="space-y-4">
                    <div className="bg-base-300/40 border border-base-300/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <RiPlugLine size={16} className="text-accent" />
                        <h4 className="text-sm font-medium">Enrichment Waterfall</h4>
                      </div>
                      <p className="text-xs text-base-content/50 mb-4 leading-relaxed">
                        Define the priority of API providers. The system will try them in order. If one runs out of credits or fails to find an email, it falls back to the next.
                      </p>
                      <textarea
                        className="textarea textarea-bordered w-full text-xs font-mono bg-base-100"
                        rows={6}
                        placeholder={'{\\n  "action_type": "enrich_email",\\n  "provider_chain": ["prospeo", "apollo", "snov", "skrapp", "hunter", "lusha", "contactout"]\\n}'}
                        value={ws.config || ""}
                        onChange={(e) => updateStep(idx, { config: e.target.value })}
                      />
                      <p className="text-[10px] text-base-content/40 mt-2">
                        * A drag-and-drop UI is coming in the next iteration. For now, specify the JSON config directly.
                      </p>
                    </div>
                  </div>
                )}`;

const newPanel = `{ws.type === "integration" && (() => {
                  let parsedConfig = { action_type: "enrich_email", provider_chain: ["prospeo", "apollo", "snov", "skrapp", "hunter", "lusha", "contactout"] };
                  try {
                    if (ws.config) parsedConfig = JSON.parse(ws.config);
                  } catch (e) {}
                  
                  return (
                    <div className="space-y-4">
                      <div className="bg-base-300/40 border border-base-300/50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-accent/10 text-accent shrink-0">
                            <RiPlugLine size={16} />
                          </span>
                          <div>
                            <h4 className="text-sm font-medium">Configure Integration</h4>
                            <p className="text-[10px] text-base-content/40">Select what this step should do</p>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="text-xs text-base-content/50 font-medium block mb-2">Action Type</label>
                            <select 
                              className="select select-bordered w-full text-sm"
                              value={parsedConfig.action_type || "enrich_email"}
                              onChange={(e) => {
                                const newConf = { ...parsedConfig, action_type: e.target.value };
                                updateStep(idx, { config: JSON.stringify(newConf) });
                              }}
                            >
                              <option value="enrich_email">Enrich Email (Waterfall)</option>
                              <option value="push_to_hubspot">Sync to HubSpot CRM</option>
                            </select>
                          </div>

                          {parsedConfig.action_type === "enrich_email" && (
                            <div className="pt-2 border-t border-base-300/50">
                              <label className="text-xs text-base-content/50 font-medium block mb-1">Waterfall Priority Array</label>
                              <p className="text-[10px] text-base-content/40 mb-3">Define the priority of API providers. The system tries them in order.</p>
                              
                              <textarea
                                className="textarea textarea-bordered w-full text-xs font-mono bg-base-100"
                                rows={4}
                                value={JSON.stringify(parsedConfig.provider_chain || [])}
                                onChange={(e) => {
                                  try {
                                    const arr = JSON.parse(e.target.value);
                                    if (Array.isArray(arr)) {
                                      updateStep(idx, { config: JSON.stringify({ ...parsedConfig, provider_chain: arr }) });
                                    }
                                  } catch (err) {}
                                }}
                              />
                            </div>
                          )}

                          {parsedConfig.action_type === "push_to_hubspot" && (
                            <div className="pt-2 border-t border-base-300/50">
                              <p className="text-xs text-base-content/60 leading-relaxed bg-primary/5 border border-primary/20 p-3 rounded-lg flex gap-2">
                                <span className="mt-0.5 text-primary"><RiPlugLine size={14} /></span>
                                This step will automatically push the contact's name, title, company, LinkedIn URL, and enriched Email to your connected HubSpot CRM account. Make sure HubSpot is configured in Settings.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}`;

code = code.replace(oldPanel, newPanel);
fs.writeFileSync('pages/workflows/[id].tsx', code);
