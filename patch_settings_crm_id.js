const fs = require('fs');
let code = fs.readFileSync('pages/settings.tsx', 'utf8');

// 1. When adding a new status, add _isNew flag
code = code.replace(
  `onClick={() => setStatuses([...statuses, { id: "new", label: "New Status", color: "bg-base-300", blocks_enrollment: false }])}`,
  `onClick={() => setStatuses([...statuses, { id: "new_status", label: "New Status", color: "bg-base-300 text-base-content", blocks_enrollment: false, _isNew: true }])}`
);

// 2. Remove the ID input and update the Label input logic
const rowAnchor = `<input type="text" className="input input-bordered input-sm w-32" placeholder="ID (e.g. lead)" value={s.id} onChange={e => { const copy = [...statuses]; copy[i].id = e.target.value; setStatuses(copy); }} />
            <input type="text" className="input input-bordered input-sm flex-1" placeholder="Label (e.g. Lead)" value={s.label} onChange={e => { const copy = [...statuses]; copy[i].label = e.target.value; setStatuses(copy); }} />`;

const rowReplace = `<input 
              type="text" 
              className="input input-bordered input-sm flex-1" 
              placeholder="Status Name" 
              value={s.label} 
              onChange={e => { 
                const val = e.target.value;
                const copy = [...statuses]; 
                copy[i].label = val; 
                if (copy[i]._isNew) {
                  copy[i].id = val.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '') || 'new_status';
                }
                setStatuses(copy); 
              }} 
            />`;

code = code.replace(rowAnchor, rowReplace);

// 3. Before saving, strip _isNew flag
code = code.replace(
  `body: JSON.stringify(statuses)`,
  `body: JSON.stringify(statuses.map(s => { const { _isNew, ...rest } = s; return rest; }))`
);

fs.writeFileSync('pages/settings.tsx', code);
