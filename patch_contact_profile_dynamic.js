const fs = require('fs');
let code = fs.readFileSync('pages/contacts/[id].tsx', 'utf8');

const stateAnchor = `  const [leadStatus, setLeadStatus] = useState(target?.lead_status ?? "lead");`;
const stateReplace = `  const [leadStatus, setLeadStatus] = useState(target?.lead_status ?? "lead");
  const [crmStatuses, setCrmStatuses] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/settings/crm-statuses").then(r => r.json()).then(setCrmStatuses).catch(() => {});
  }, []);`;
code = code.replace(stateAnchor, stateReplace);

const uiAnchor = `                  <option value="lead">Lead</option>
                  <option value="nurture">Nurture</option>
                  <option value="meeting_scheduled">Meeting Scheduled</option>
                  <option value="customer">Customer</option>
                  <option value="disqualified">Disqualified</option>`;
const uiReplace = `                  {crmStatuses.length > 0 ? crmStatuses.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  )) : (
                    <>
                      <option value="lead">Lead</option>
                      <option value="nurture">Nurture</option>
                      <option value="meeting_scheduled">Meeting Scheduled</option>
                      <option value="customer">Customer</option>
                      <option value="disqualified">Disqualified</option>
                    </>
                  )}`;
code = code.replace(uiAnchor, uiReplace);

const selectAnchor = `                <select 
                  className="select select-bordered select-xs bg-base-300 text-xs font-medium ml-2"`;
const selectReplace = `                <select 
                  className={\`select select-bordered select-xs text-xs font-medium ml-2 \${crmStatuses.find(s => s.id === (leadStatus || 'lead'))?.color || 'bg-base-300'}\`}`;
code = code.replace(selectAnchor, selectReplace);

fs.writeFileSync('pages/contacts/[id].tsx', code);
