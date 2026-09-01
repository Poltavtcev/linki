const fs = require('fs');
let code = fs.readFileSync('pages/contacts/index.tsx', 'utf8');

const stateAnchor = `  const [filters, setFilters] = useState<ActiveFilter[]>([]);`;
const stateReplace = `  const [filters, setFilters] = useState<ActiveFilter[]>([]);
  const [crmStatuses, setCrmStatuses] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/settings/crm-statuses").then(r => r.json()).then(setCrmStatuses).catch(() => {});
  }, []);`;
code = code.replace(stateAnchor, stateReplace);

const uiAnchor = `                          <option value="lead">Lead</option>
                          <option value="nurture">Nurture</option>
                          <option value="meeting_scheduled">Meeting</option>
                          <option value="customer">Customer</option>
                          <option value="disqualified">Disqualified</option>`;
const uiReplace = `                          {crmStatuses.length > 0 ? crmStatuses.map(s => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          )) : (
                            <>
                              <option value="lead">Lead</option>
                              <option value="nurture">Nurture</option>
                              <option value="meeting_scheduled">Meeting</option>
                              <option value="customer">Customer</option>
                              <option value="disqualified">Disqualified</option>
                            </>
                          )}`;
code = code.replace(uiAnchor, uiReplace);

// Also add styling based on the status!
const selectAnchor = `                        <select 
                          className="select select-bordered select-xs bg-base-300/50 w-28 text-[11px]" `;
const selectReplace = `                        <select 
                          className={\`select select-bordered select-xs w-28 text-[11px] \${crmStatuses.find(s => s.id === (c.lead_status || 'lead'))?.color || 'bg-base-300/50'}\`} `;
code = code.replace(selectAnchor, selectReplace);

fs.writeFileSync('pages/contacts/index.tsx', code);
