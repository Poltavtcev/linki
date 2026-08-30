const fs = require('fs');
const content = fs.readFileSync('lib/linkedin/scraper.ts', 'utf8');

let newContent = content.replace(
  /  await page.close\(\);\n  return \{\n    profiles: allElements.map\(el => profileToResult\(el, null\)\),\n    lastPage,\n    knownTotal,\n    exhausted: lastPage >= totalPages,\n  \};\n\}\n\n\/\*\*/,
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
fs.writeFileSync('lib/linkedin/scraper.ts', newContent);
