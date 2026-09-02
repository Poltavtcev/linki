const fs = require('fs');
let code = fs.readFileSync('pages/lists/[id].tsx', 'utf8');

const stateAnchor = `  const [syncAccountId, setSyncAccountId] = useState("");`;
const stateReplace = `  const [syncAccountId, setSyncAccountId] = useState("");
  const [crmStatuses, setCrmStatuses] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/settings/crm-statuses").then(r => r.json()).then(setCrmStatuses).catch(() => {});
  }, []);`;

code = code.replace(stateAnchor, stateReplace);

// We also need to add lead_status to the Target interface in this file if it exists, or just use 'any'.
code = code.replace(
  `interface Target {`,
  `interface Target {
  lead_status?: string | null;`
);

fs.writeFileSync('pages/lists/[id].tsx', code);
