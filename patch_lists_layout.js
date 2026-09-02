const fs = require('fs');
let code = fs.readFileSync('pages/lists/[id].tsx', 'utf8');

// 1. Remove the old "Status" header after "Location"
code = code.replace(
  `                  <th>Location</th>
                  <th className="w-24">Status</th>
                  <th className="w-20"></th>`,
  `                  <th>Location</th>
                  <th className="w-20"></th>`
);

// 2. Add "CRM" header after "Name"
code = code.replace(
  `                  <th>Name</th>
                  <th>Title</th>`,
  `                  <th>Name</th>
                  <th>CRM</th>
                  <th>Title</th>`
);

// 3. Move the TD block
const oldTdBlock = `                    <td className="text-base-content/40 text-xs">{t.location ?? "—"}</td>
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

const newTdBlock = `                    <td className="text-base-content/40 text-xs">{t.location ?? "—"}</td>
                    <td onClick={(e) => e.stopPropagation()}>`;

code = code.replace(oldTdBlock, newTdBlock);

// 4. Insert the TD block after Name
const nameTd = `<td className="font-medium">{t.full_name ?? "—"}</td>`;
const crmTd = `                    <td onClick={(e) => e.stopPropagation()}>
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
                    </td>`;

code = code.replace(
  `                    <td className="font-medium">{t.full_name ?? "—"}</td>
                    <td className="text-base-content/60 max-w-50 truncate">{t.title ?? "—"}</td>`,
  `                    <td className="font-medium">{t.full_name ?? "—"}</td>
${crmTd}
                    <td className="text-base-content/60 max-w-50 truncate">{t.title ?? "—"}</td>`
);

fs.writeFileSync('pages/lists/[id].tsx', code);
