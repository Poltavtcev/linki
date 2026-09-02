const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

code = code.replace(
  `className="toggle toggle-sm toggle-primary"`,
  `className="toggle toggle-success border-base-content/30"`
);

fs.writeFileSync('pages/workflows/[id].tsx', code);
