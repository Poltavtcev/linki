const fs = require('fs');
let code = fs.readFileSync('lib/linkedin/scraper.ts', 'utf8');

// Function 1: scrapeNavigatorList
code = code.replace(
  'const page = await ctx.newPage();\\n  let knownTotal = 0;\\n  let intercepted: FlatResponse | null = null;',
  'const page = await ctx.newPage();\\n  let knownTotal = 0;\\n  let lastPage = startPage;\\n  let totalPages = startPage;\\n  try {\\n    let intercepted: FlatResponse | null = null;'
);
code = code.replace(
  '  const totalPages = Math.ceil(knownTotal / PAGE_SIZE);\\n  const endPage = Math.min(totalPages, startPage + maxPages - 1);\\n  let lastPage = startPage;',
  '  totalPages = Math.ceil(knownTotal / PAGE_SIZE);\\n  const endPage = Math.min(totalPages, startPage + maxPages - 1);'
);
code = code.replace(
  '  await page.close();\\n  return {\\n    profiles: allElements.map(el => profileToResult(el, null)),\\n    lastPage,\\n    knownTotal,\\n    exhausted: lastPage >= totalPages,\\n  };\\n}\\n\\nexport async function scrapeSavedSearch(',
  '  } finally {\\n    await page.close().catch(() => {});\\n  }\\n  return {\\n    profiles: allElements.map(el => profileToResult(el, null)),\\n    lastPage,\\n    knownTotal,\\n    exhausted: lastPage >= totalPages,\\n  };\\n}\\n\\nexport async function scrapeSavedSearch('
);

// Function 2: scrapeSavedSearch
code = code.replace(
  'const page = await ctx.newPage();\\n  let knownTotal = 0;\\n\\n  const waitForIntercept',
  'const page = await ctx.newPage();\\n  let knownTotal = 0;\\n  let lastPage = startPage;\\n  let totalPages = startPage;\\n  try {\\n\\n  const waitForIntercept'
);
code = code.replace(
  '  const totalPages = Math.ceil(knownTotal / PAGE_SIZE);\\n  const endPage = Math.min(totalPages, startPage + maxPages - 1);\\n  let lastPage = startPage;',
  '  totalPages = Math.ceil(knownTotal / PAGE_SIZE);\\n  const endPage = Math.min(totalPages, startPage + maxPages - 1);'
);
code = code.replace(
  '  await page.close();\\n  return {\\n    profiles: allElements.map(el => profileToResult(el, null)),\\n    lastPage,\\n    knownTotal,\\n    exhausted: lastPage >= totalPages,\\n  };\\n}\\n\\n/**',
  '  } finally {\\n    await page.close().catch(() => {});\\n  }\\n  return {\\n    profiles: allElements.map(el => profileToResult(el, null)),\\n    lastPage,\\n    knownTotal,\\n    exhausted: lastPage >= totalPages,\\n  };\\n}\\n\\n/**'
);

// Fix race condition in both
code = code.replace(
  /    await page\.goto\(url, \{ waitUntil: "domcontentloaded", timeout: 30000 \}\);\n    return interceptPromise;\n  \};/g,
  \`    const gotoPromise = page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await Promise.race([
      gotoPromise.catch(e => {
        clearTimeout(timeout);
        throw e;
      }),
      interceptPromise
    ]);
    return interceptPromise;
  };\`
);

fs.writeFileSync('lib/linkedin/scraper.ts', code.split('\\\\n').join('\\n'));
