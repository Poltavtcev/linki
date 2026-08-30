const fs = require('fs');
let content = fs.readFileSync('lib/linkedin/inbox-sync.ts', 'utf8');
content = content.replace(
  /function boundedEventId\(accountId: string, threadId: string, messageId: string, providerEventId: string \| null\): string \{\n  const candidate = providerEventId\n    \? \`linkedin:\$\{accountId\}:provider:\$\{providerEventId\}\`\n    : \`linkedin:\$\{accountId\}:\$\{threadId\}:\$\{messageId\}\`;/g,
  `function boundedEventId(accountId: string, threadId: string, messageId: string, providerEventId: string | null): string {\n  const candidate = \`linkedin:\${accountId}:\${threadId}:\${messageId}\`;`
);
fs.writeFileSync('lib/linkedin/inbox-sync.ts', content);
