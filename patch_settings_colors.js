const fs = require('fs');
let code = fs.readFileSync('pages/settings.tsx', 'utf8');

const themeColors = `const THEME_COLORS = [
  { value: "bg-base-300 text-base-content", label: "Neutral / Gray" },
  { value: "bg-primary/20 text-primary", label: "Primary (Light)" },
  { value: "bg-primary text-primary-content", label: "Primary (Solid)" },
  { value: "bg-secondary/20 text-secondary", label: "Secondary (Light)" },
  { value: "bg-info/20 text-info", label: "Info / Blue" },
  { value: "bg-success/20 text-success", label: "Success (Light)" },
  { value: "bg-success text-success-content", label: "Success (Solid)" },
  { value: "bg-warning/20 text-warning", label: "Warning / Yellow" },
  { value: "bg-error/20 text-error", label: "Error / Red" }
];`;

const inputAnchor = `<input type="text" className="input input-bordered input-sm flex-1" placeholder="Color CSS (e.g. bg-base-300)" value={s.color} onChange={e => { const copy = [...statuses]; copy[i].color = e.target.value; setStatuses(copy); }} />`;

const inputReplace = `
            <select 
              className={\`select select-bordered select-sm w-48 font-medium \${s.color}\`}
              value={s.color} 
              onChange={e => { const copy = [...statuses]; copy[i].color = e.target.value; setStatuses(copy); }}
            >
              {THEME_COLORS.map(tc => (
                <option key={tc.value} value={tc.value} className={tc.value}>{tc.label}</option>
              ))}
            </select>`;

code = code.replace(`function CrmTab() {`, `${themeColors}\nfunction CrmTab() {`);
code = code.replace(inputAnchor, inputReplace);
fs.writeFileSync('pages/settings.tsx', code);
