const fs = require('fs');
let content = fs.readFileSync('lib/linkedin/inbox-sync.ts', 'utf8');
content = content.replace(
  /  const providerEventId = normalized\.providerEventId \|\| null;\n  const candidate = providerEventId\n    \? \`linkedin:\$\{accountId\}:provider:\$\{providerEventId\}\`\n    : \`linkedin:\$\{accountId\}:\$\{threadId\}:\$\{messageId\}\`;/g,
  `  const candidate = \`linkedin:\${accountId}:\${threadId}:\${messageId}\`;`
);
fs.writeFileSync('lib/linkedin/inbox-sync.ts', content);
