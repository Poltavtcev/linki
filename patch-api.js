const fs = require('fs');
let code = fs.readFileSync('pages/api/targets/[id].ts', 'utf8');

code = code.replace(
  /"email", "phone", "headline", "summary", "notes",/,
  `"email", "phone", "headline", "summary", "notes", "company_id",`
);

fs.writeFileSync('pages/api/targets/[id].ts', code);
