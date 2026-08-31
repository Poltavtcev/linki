const fs = require('fs');
let content = fs.readFileSync('pages/api/inbox/index.ts', 'utf8');

content = content.replace(/  run_id: string \| null;/g, '  run_id: string | null;\n  account_id: string | null;\n  linkedin_thread_id: string | null;');

fs.writeFileSync('pages/api/inbox/index.ts', content);
