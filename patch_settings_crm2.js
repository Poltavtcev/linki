const fs = require('fs');
let code = fs.readFileSync('pages/settings.tsx', 'utf8');

if (!code.includes('import { RiGroupLine }')) {
  code = code.replace(
    `import {`,
    `import { RiGroupLine } from "react-icons/ri";\nimport {`
  );
}

const crmTabCode = `
// ─── CRM Tab ─────────────────────────────────────────────────────────────────
function CrmTab() {
  const [statuses, setStatuses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings/crm-statuses").then(r => r.json()).then(d => { setStatuses(d); setLoading(false); });
  }, []);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/settings/crm-statuses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(statuses)
      });
      toast.success("Saved CRM settings");
    } catch(e) {
      toast.error("Failed to save");
    }
    setSaving(false);
  }

  if (loading) return <div className="p-8 text-center text-base-content/50"><span className="loading loading-spinner" /></div>;

  return (
    <div>
      <h2 className="text-lg font-medium mb-4">Contact Statuses (Mini-CRM)</h2>
      <p className="text-sm text-base-content/60 mb-6 max-w-2xl">
        Define the statuses available for contacts. Check the <b>Blocks Enrollment</b> box to prevent automated campaigns from enrolling contacts with that status.
      </p>

      <div className="space-y-3 mb-6 max-w-2xl">
        {statuses.map((s, i) => (
          <div key={i} className="flex gap-3 items-center bg-base-200 p-3 rounded-lg border border-base-300">
            <input type="text" className="input input-bordered input-sm w-32" placeholder="ID (e.g. lead)" value={s.id} onChange={e => { const copy = [...statuses]; copy[i].id = e.target.value; setStatuses(copy); }} />
            <input type="text" className="input input-bordered input-sm flex-1" placeholder="Label (e.g. Lead)" value={s.label} onChange={e => { const copy = [...statuses]; copy[i].label = e.target.value; setStatuses(copy); }} />
            <input type="text" className="input input-bordered input-sm flex-1" placeholder="Color CSS (e.g. bg-base-300)" value={s.color} onChange={e => { const copy = [...statuses]; copy[i].color = e.target.value; setStatuses(copy); }} />
            <label className="flex items-center gap-2 text-sm cursor-pointer ml-4">
              <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={s.blocks_enrollment} onChange={e => { const copy = [...statuses]; copy[i].blocks_enrollment = e.target.checked; setStatuses(copy); }} />
              Blocks Enrollment
            </label>
            <button className="btn btn-ghost btn-xs text-error ml-2" onClick={() => setStatuses(statuses.filter((_, idx) => idx !== i))}><RiCloseLine size={16} /></button>
          </div>
        ))}
      </div>
      
      <div className="flex gap-3 max-w-2xl">
        <button className="btn btn-outline btn-sm border-base-300" onClick={() => setStatuses([...statuses, { id: "new", label: "New Status", color: "bg-base-300", blocks_enrollment: false }])}>
          <RiAddLine size={14} /> Add Status
        </button>
        <button className="btn btn-primary btn-sm ml-auto" onClick={save} disabled={saving}>
          {saving ? <span className="loading loading-spinner loading-xs" /> : "Save"}
        </button>
      </div>
    </div>
  );
}
`;

if (!code.includes('function CrmTab')) {
  code += crmTabCode;
}

fs.writeFileSync('pages/settings.tsx', code);
