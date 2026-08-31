const fs = require('fs');
let content = fs.readFileSync('pages/api/system/breaker.ts', 'utf8');
content = content.replace(/@\/lib\/db/g, '../../../lib/db').replace(/@\/lib\/linkedin\/circuit-breaker/g, '../../../lib/linkedin/circuit-breaker');
fs.writeFileSync('pages/api/system/breaker.ts', content);
