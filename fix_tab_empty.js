const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

// Fix empty message
code = code.replace(
  /\{track === "linkedin" \? "No LinkedIn steps yet\. Add your first step below\." : "No email steps yet\. Add your first step below\."\}/,
  '{track === "linkedin" ? "No LinkedIn steps yet. Add your first step below." : track === "email" ? "No email steps yet. Add your first step below." : "No integration steps yet. Add your first step below."}'
);

fs.writeFileSync('pages/workflows/[id].tsx', code);
