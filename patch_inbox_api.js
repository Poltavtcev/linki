const fs = require('fs');
let content = fs.readFileSync('pages/api/inbox/index.ts', 'utf8');

content = content.replace(/account_id: string;/g, 'account_id: string | null;\n  linkedin_thread_id: string | null;');
content = content.replace(/r\.id AS run_id,/g, 'r.id AS run_id,\n      r.account_id,\n      er.in_reply_to AS linkedin_thread_id,');

fs.writeFileSync('pages/api/inbox/index.ts', content);
