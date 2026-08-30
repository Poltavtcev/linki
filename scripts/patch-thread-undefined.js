const fs = require('fs');
let code = fs.readFileSync('pages/api/inbox/thread.ts', 'utf8');

code = code.replace(/graph\.get\(u\)\.add\(v\);/, 'graph.get(u)!.add(v);');
code = code.replace(/graph\.get\(v\)\.add\(u\);/, 'graph.get(v)!.add(u);');
code = code.replace(/graph\.get\(curr\)\) \{/, 'graph.get(curr)!) {');

fs.writeFileSync('pages/api/inbox/thread.ts', code);
