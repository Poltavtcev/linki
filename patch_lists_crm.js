const fs = require('fs');
let code = fs.readFileSync('pages/lists/[id].tsx', 'utf8');

// 1. Fetch CRM statuses
const stateAnchor = `  const [syncAccountId, setSyncAccountId] = useState<string>("");`;
const stateReplace = `  const [syncAccountId, setSyncAccountId] = useState<string>("");
  const [crmStatuses, setCrmStatuses] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/settings/crm-statuses").then(r => r.json()).then(setCrmStatuses).catch(() => {});
  }, []);`;

code = code.replace(stateAnchor, stateReplace);

// 2. Add table header
const thAnchor = `                  <th>Location</th>
                  <th className="w-20"></th>`;
const thReplace = `                  <th>Location</th>
                  <th className="w-24">Status</th>
                  <th className="w-20"></th>`;
code = code.replace(thAnchor, thReplace);

// 3. Add table cell with dropdown
const tdAnchor = `                    <td className="text-base-content/40 text-xs">{t.location ?? "—"}</td>
                    <td onClick={(e) => e.stopPropagation()}>`;
const tdReplace = `                    <td className="text-base-content/40 text-xs">{t.location ?? "—"}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select 
                        className={\`select select-bordered select-xs w-28 text-[11px] \${crmStatuses.find(s => s.id === (t.lead_status || 'lead'))?.color || 'bg-base-300/50'}\`} 
                        value={t.lead_status || 'lead'}
                        onChange={(e) => {
                          const newVal = e.target.value;
                          fetch(\`/api/targets/\${t.id}\`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ lead_status: newVal })
                          });
                          setTargets(targets.map(x => x.id === t.id ? { ...x, lead_status: newVal } : x));
                        }}
                      >
                        {crmStatuses.length > 0 ? crmStatuses.map(s => (
                          <option key={s.id} value={s.id} className="bg-base-200 text-base-content">{s.label}</option>
                        )) : (
                          <>
                            <option value="lead">Lead</option>
                            <option value="nurture">Nurture</option>
                            <option value="meeting_scheduled">Meeting</option>
                            <option value="customer">Customer</option>
                            <option value="disqualified">Disqualified</option>
                          </>
                        )}
                      </select>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>`;

code = code.replace(tdAnchor, tdReplace);

fs.writeFileSync('pages/lists/[id].tsx', code);
