const fs = require('fs');
let code = fs.readFileSync('components/ui/FilterBar.tsx', 'utf8');

const anchor = `export default function FilterBar({ filters, onChange, fieldSubset }: FilterBarProps) {`;
const replacement = `export default function FilterBar({ filters, onChange, fieldSubset }: FilterBarProps) {
  useEffect(() => {
    fetch("/api/settings/crm-statuses")
      .then(r => r.json())
      .then(statuses => {
        const leadField = FILTER_FIELDS.find(f => f.key === "lead_status");
        if (leadField) {
          leadField.options = statuses.map((s: any) => ({ value: s.id, label: s.label }));
        }
      })
      .catch(() => {});
  }, []);`;

code = code.replace(anchor, replacement);
fs.writeFileSync('components/ui/FilterBar.tsx', code);
