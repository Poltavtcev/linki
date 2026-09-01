const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

// 1. API save payload
code = code.replace(
  `config: ws.type === "integration" ? ws.config : null,`,
  `config: (ws.type === "integration" || ws.type === "change_status") ? ws.config : null,`
);

// 2. State definition inside Wizard for CRM statuses (needed for the dropdown)
if (!code.includes(`const [crmStatuses, setCrmStatuses] = useState<any[]>([]);`)) {
  code = code.replace(
    `  const [integrations, setIntegrations] = useState<{ key: string; configured: boolean }[]>([]);`,
    `  const [integrations, setIntegrations] = useState<{ key: string; configured: boolean }[]>([]);
  const [crmStatuses, setCrmStatuses] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/settings/crm-statuses").then(r => r.json()).then(setCrmStatuses).catch(() => {});
  }, []);`
  );
}

// 3. UI block
const anchor = `                {ws.type === "integration" && (() => {`;
const replacement = `                {ws.type === "change_status" && (() => {
                  let parsedConfig = { status_id: "lead" };
                  try {
                    if (ws.config && ws.config !== "null") {
                      const p = JSON.parse(ws.config);
                      if (p && typeof p === "object") parsedConfig = { ...parsedConfig, ...p };
                    }
                  } catch (e) {}

                  return (
                    <div className="p-6">
                      <div className="mb-6">
                        <label className="block text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-2">New Status</label>
                        <select
                          className="select select-bordered bg-base-300 w-full"
                          value={parsedConfig.status_id}
                          onChange={(e) => {
                            const newConfig = { ...parsedConfig, status_id: e.target.value };
                            setWizardSteps((prev) => prev.map((s, idx) => idx === configIdx ? { ...s, config: JSON.stringify(newConfig) } : s));
                          }}
                        >
                          {crmStatuses.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </select>
                        <p className="text-xs text-base-content/50 mt-2">When this step is reached, the contact's CRM status will be updated to this value.</p>
                      </div>
                    </div>
                  );
                })()}
                
                {ws.type === "integration" && (() => {`;

code = code.replace(anchor, replacement);
fs.writeFileSync('pages/workflows/[id].tsx', code);
