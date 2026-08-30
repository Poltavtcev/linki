const fs = require('fs');
let code = fs.readFileSync('pages/api/inbox/thread.ts', 'utf8');

code = code.replace(/addEdge = \(u, v\)/, 'addEdge = (u: string, v: string)');
code = code.replace(/const connected = new Set\(\);/, 'const connected = new Set<string>();');
code = code.replace(/filter\(\(r\) => typeof r === 'string'\)/, "filter((r): r is string => typeof r === 'string')");

fs.writeFileSync('pages/api/inbox/thread.ts', code);
