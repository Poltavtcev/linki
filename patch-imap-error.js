const fs = require('fs');
let content = fs.readFileSync('lib/email/inbox.ts', 'utf8');

content = content.replace(
  /fetch\.once\("error", \(\) => resolve\(null\)\);/g,
  `fetch.once("error", (err) => reject(err));`
);

fs.writeFileSync('lib/email/inbox.ts', content);
