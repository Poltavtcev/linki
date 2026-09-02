const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

code = code.replace(
  `className="toggle toggle-primary toggle-sm"`,
  `className="checkbox checkbox-primary"`
);

fs.writeFileSync('pages/workflows/[id].tsx', code);
