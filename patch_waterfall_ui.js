const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

const anchor = `{ws.type === "email" && (`;
const ui = `                {ws.type === "integration" && (
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
                )}

                `;

code = code.replace(anchor, ui + anchor);
fs.writeFileSync('pages/workflows/[id].tsx', code);
