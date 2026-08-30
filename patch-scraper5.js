const fs = require('fs');
let content = fs.readFileSync('lib/linkedin/scraper.ts', 'utf8');

content = content.replace(
  /const totalPages = Math\.ceil\(knownTotal \/ PAGE_SIZE\);/g,
  `totalPages = Math.ceil(knownTotal / PAGE_SIZE);`
);

content = content.replace(
  /let lastPage = startPage;/g,
  `` // Just remove it since it's already declared
);

fs.writeFileSync('lib/linkedin/scraper.ts', content);
