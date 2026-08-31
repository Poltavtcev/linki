const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

// 1. Add state for integrations inside Wizard
const stateAnchor = `  const [wizardSteps, setWizardSteps] = useState<WizardStep[]>(() => buildWizardSteps(initialSteps));`;
const stateReplacement = `  const [wizardSteps, setWizardSteps] = useState<WizardStep[]>(() => buildWizardSteps(initialSteps));
  const [integrations, setIntegrations] = useState<{ key: string; configured: boolean }[]>([]);
  useEffect(() => {
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((rows) => setIntegrations(rows))
      .catch(() => {});
  }, []);`;
if (!code.includes('setIntegrations')) code = code.replace(stateAnchor, stateReplacement);

// 2. Add ENRICHERS array outside of Wizard (or top level)
const enrichersAnchor = `// ─── Wizard ───────────────────────────────────────────────────────────────────`;
const enrichersReplacement = `// ─── Wizard ───────────────────────────────────────────────────────────────────
const ENRICHERS = ["prospeo", "apollo", "snov", "skrapp", "hunter", "lusha", "contactout"];
const PROVIDER_NAMES: Record<string, string> = {
  prospeo: "Prospeo",
  apollo: "Apollo",
  snov: "Snov.io",
  skrapp: "Skrapp.io",
  hunter: "Hunter",
  lusha: "Lusha",
  contactout: "ContactOut"
};`;
if (!code.includes('PROVIDER_NAMES')) code = code.replace(enrichersAnchor, enrichersReplacement);

// 3. Replace the specific textarea
const uiAnchor = `                              <textarea
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
                              />`;

const uiReplacement = `                              <div className="space-y-2">
                                {(() => {
                                  const configured = integrations.filter((i) => i.configured && ENRICHERS.includes(i.key)).map((i) => i.key);
                                  if (configured.length === 0) {
                                    return (
                                      <div className="p-3 bg-warning/10 text-warning text-xs rounded-lg border border-warning/20">
                                        No email enrichers configured. Go to Settings &gt; Integrations to add API keys.
                                      </div>
                                    );
                                  }

                                  const chain: string[] = Array.isArray(parsedConfig.provider_chain) ? parsedConfig.provider_chain : [];
                                  
                                  // Find the active providers in order, then append inactive ones at the bottom
                                  const active = chain.filter((k) => configured.includes(k));
                                  const inactive = configured.filter((k) => !active.includes(k));
                                  const all = [...active, ...inactive];

                                  return (
                                    <div className="flex flex-col gap-1.5">
                                      {all.map((key, i) => {
                                        const isEnabled = active.includes(key);
                                        return (
                                          <div key={key} className={\`flex items-center justify-between p-2 rounded-lg border \${isEnabled ? 'bg-base-200/50 border-base-300' : 'bg-base-100 border-base-200/50 opacity-60'}\`}>
                                            <div className="flex items-center gap-3">
                                              <input
                                                type="checkbox"
                                                className="toggle toggle-sm toggle-primary"
                                                checked={isEnabled}
                                                onChange={(e) => {
                                                  let newChain = [...active];
                                                  if (e.target.checked) newChain.push(key);
                                                  else newChain = newChain.filter((k) => k !== key);
                                                  updateStep(idx, { config: JSON.stringify({ ...parsedConfig, provider_chain: newChain }) });
                                                }}
                                              />
                                              <span className="text-sm font-medium">{PROVIDER_NAMES[key] || key}</span>
                                            </div>
                                            {isEnabled && (
                                              <div className="flex items-center gap-1">
                                                <button
                                                  className="p-1 hover:bg-base-300 rounded text-base-content/50 disabled:opacity-30 disabled:hover:bg-transparent"
                                                  disabled={i === 0 || !active.includes(all[i - 1])}
                                                  onClick={() => {
                                                    const newChain = [...active];
                                                    const activeIdx = newChain.indexOf(key);
                                                    if (activeIdx > 0) {
                                                      [newChain[activeIdx - 1], newChain[activeIdx]] = [newChain[activeIdx], newChain[activeIdx - 1]];
                                                      updateStep(idx, { config: JSON.stringify({ ...parsedConfig, provider_chain: newChain }) });
                                                    }
                                                  }}
                                                >
                                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                                                </button>
                                                <button
                                                  className="p-1 hover:bg-base-300 rounded text-base-content/50 disabled:opacity-30 disabled:hover:bg-transparent"
                                                  disabled={i === active.length - 1 || !active.includes(all[i + 1])}
                                                  onClick={() => {
                                                    const newChain = [...active];
                                                    const activeIdx = newChain.indexOf(key);
                                                    if (activeIdx < active.length - 1) {
                                                      [newChain[activeIdx], newChain[activeIdx + 1]] = [newChain[activeIdx + 1], newChain[activeIdx]];
                                                      updateStep(idx, { config: JSON.stringify({ ...parsedConfig, provider_chain: newChain }) });
                                                    }
                                                  }}
                                                >
                                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>`;

code = code.replace(uiAnchor, uiReplacement);
fs.writeFileSync('pages/workflows/[id].tsx', code);
