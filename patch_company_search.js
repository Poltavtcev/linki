const fs = require('fs');
let code = fs.readFileSync('pages/companies/[id].tsx', 'utf8');

code = code.replace(/<span className="text-sm font-medium text-base-content">\{c\.full_name\}<\/span>/, 
  '<span className="text-sm font-medium text-base-content">{c.first_name} {c.last_name}</span>');

fs.writeFileSync('pages/companies/[id].tsx', code);
