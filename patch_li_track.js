const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

code = code.replace(
  /\? \(\["visit", "connect", "message", "sales_inmail"\] as const\)/,
  '? (["visit", "connect", "message", "sales_inmail", "integration"] as const)'
);

fs.writeFileSync('pages/workflows/[id].tsx', code);
