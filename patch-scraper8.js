const fs = require('fs');
let content = fs.readFileSync('lib/linkedin/scraper.ts', 'utf8');

content = content.replace(
  /  let totalPages = startPage;\n  try \{/g,
  `  let knownTotal = 0;\n  let lastPage = startPage;\n  let totalPages = startPage;\n  try {`
);

fs.writeFileSync('lib/linkedin/scraper.ts', content);
