const fs = require('fs');
let content = fs.readFileSync('lib/email/inbox.ts', 'utf8');

content = content.replace(
  /return new Promise<string \| null>\(\(resolve\) => \{/g,
  `return new Promise<string | null>((resolve, reject) => {`
);

fs.writeFileSync('lib/email/inbox.ts', content);
