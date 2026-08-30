const fs = require('fs');
let content = fs.readFileSync('lib/linkedin/scraper.ts', 'utf8');

// scrapeNavigatorList
content = content.replace(
  /const page = await ctx\.newPage\(\);\n  let knownTotal = 0;\n  let intercepted: FlatResponse \| null = null;/,
  `const page = await ctx.newPage();
  let knownTotal = 0;
  let lastPage = startPage;
  let totalPages = startPage;
  try {
    let intercepted: FlatResponse | null = null;`
);

content = content.replace(
  /  const totalPages = Math\.ceil\(knownTotal \/ PAGE_SIZE\);\n  const endPage = Math\.min\(totalPages, startPage \+ maxPages - 1\);\n  let lastPage = startPage;/,
  `  totalPages = Math.ceil(knownTotal / PAGE_SIZE);
  const endPage = Math.min(totalPages, startPage + maxPages - 1);`
);

content = content.replace(
  /  await page\.close\(\);\n  return \{\n    profiles: allElements\.map\(el => profileToResult\(el, null\)\),\n    lastPage,\n    knownTotal,\n    exhausted: lastPage >= totalPages,\n  \};\n\}/,
  `  } finally {
    await page.close().catch(() => {});
  }
  return {
    profiles: allElements.map(el => profileToResult(el, null)),
    lastPage,
    knownTotal,
    exhausted: lastPage >= totalPages,
  };
}`
);

// scrapeSavedSearch
content = content.replace(
  /const page = await ctx\.newPage\(\);\n  let knownTotal = 0;/,
  `const page = await ctx.newPage();
  let knownTotal = 0;
  let lastPage = startPage;
  let totalPages = startPage;
  try {`
);

content = content.replace(
  /  const totalPages = Math\.ceil\(knownTotal \/ PAGE_SIZE\);\n  const endPage = Math\.min\(totalPages, startPage \+ maxPages - 1\);\n  let lastPage = startPage;/,
  `  totalPages = Math.ceil(knownTotal / PAGE_SIZE);
  const endPage = Math.min(totalPages, startPage + maxPages - 1);`
);

content = content.replace(
  /  await page\.close\(\);\n  return \{\n    profiles: allElements\.map\(el => profileToResult\(el, null\)\),\n    lastPage,\n    knownTotal,\n    exhausted: lastPage >= totalPages,\n  \};\n\}\n\n\/\*\*/,
  `  } finally {
    await page.close().catch(() => {});
  }
  return {
    profiles: allElements.map(el => profileToResult(el, null)),
    lastPage,
    knownTotal,
    exhausted: lastPage >= totalPages,
  };
}

/**`
);

// Race conditions
content = content.replace(
  /    await page\.goto\(url, \{ waitUntil: "domcontentloaded", timeout: 30000 \}\);\n    return interceptPromise;\n  \};/g,
  `    const gotoPromise = page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await Promise.race([
      gotoPromise.catch(e => {
        clearTimeout(timeout);
        throw e;
      }),
      interceptPromise
    ]);
    return interceptPromise;
  };`
);

fs.writeFileSync('lib/linkedin/scraper.ts', content);
