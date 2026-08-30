const fs = require('fs');
let code = fs.readFileSync('pages/api/inbox/thread.ts', 'utf8');

code = code.replace(/const curr = queue.pop\(\);\\n\\s*if \\(connected\.has\\(curr\\)\\) continue;/, 'const curr = queue.pop()!;\\n                if (connected.has(curr)) continue;');
code = code.replace(/const curr = queue.pop\(\);/g, 'const curr = queue.pop()!;');

fs.writeFileSync('pages/api/inbox/thread.ts', code);
