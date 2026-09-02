const fs = require('fs');
let code = fs.readFileSync('pages/contacts/[id].tsx', 'utf8');

code = code.replace(/router\.replace\(router\.asPath\);/g, "window.location.reload();");

fs.writeFileSync('pages/contacts/[id].tsx', code);
