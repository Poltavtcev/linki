const fs = require('fs');
const content = fs.readFileSync('lib/linkedin/scraper.ts', 'utf8');

let newContent = content.replace(
  /const page = await ctx.newPage\(\);\n  let knownTotal = 0;\n  let intercepted: FlatResponse \| null = null;/,
  `const page = await ctx.newPage();
  try {
    let knownTotal = 0;
    let intercepted: FlatResponse | null = null;`
);

newContent = newContent.replace(
  /  await page.close\(\);\n  return \{\n    profiles: allElements.map\(el => profileToResult\(el, null\)\),\n    lastPage,\n    knownTotal,\n    exhausted: lastPage >= totalPages,\n  \};\n\}/,
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

// Fix waitForIntercept goto bug in scrapeNavigatorList
newContent = newContent.replace(
  /    await page.goto\(url, \{ waitUntil: "domcontentloaded", timeout: 30000 \}\);\n    return interceptPromise;\n  \};/g,
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

fs.writeFileSync('lib/linkedin/scraper.ts', newContent);
