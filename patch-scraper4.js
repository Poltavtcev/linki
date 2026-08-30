const fs = require('fs');
let content = fs.readFileSync('lib/linkedin/scraper.ts', 'utf8');

// For scrapeNavigatorList
content = content.replace(
  /  try \{\n    let knownTotal = 0;/,
  `  let knownTotal = 0;
  let lastPage = startPage;
  let totalPages = startPage;
  try {`
);

// For scrapeSavedSearch
content = content.replace(
  /  try \{\n    let knownTotal = 0;\n\n  const waitForIntercept/g,
  `  let knownTotal = 0;
  let lastPage = startPage;
  let totalPages = startPage;
  try {

  const waitForIntercept`
);

fs.writeFileSync('lib/linkedin/scraper.ts', content);
