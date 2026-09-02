const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

code = code.replace(
  `className="checkbox checkbox-primary"`,
  `className="toggle toggle-sm toggle-primary"`
);

fs.writeFileSync('pages/workflows/[id].tsx', code);
