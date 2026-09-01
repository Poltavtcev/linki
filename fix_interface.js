const fs = require('fs');
let code = fs.readFileSync('pages/contacts/[id].tsx', 'utf8');

code = code.replace('location: string | null;\n  lead_status: string | null;', 'location: string | null;');
const anchor = `  location: string | null;
  degree: number | null;`;
const replacement = `  location: string | null;
  lead_status: string | null;
  degree: number | null;`;
code = code.replace(anchor, replacement);

fs.writeFileSync('pages/contacts/[id].tsx', code);
