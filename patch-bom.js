const fs = require('fs');
let code = fs.readFileSync('lib/csv-import.ts', 'utf8');

code = code.replace(
  /return Papa\.unparse\(\{ fields: \[\.\.\.TEMPLATE_COLUMNS\], data: \[sample\] \}\);/,
  `// Add UTF-8 BOM so Excel and Mac editors (Nova/Numbers) force UTF-8 instead of ASCII/Latin fallback
  return "\\uFEFF" + Papa.unparse({ fields: [...TEMPLATE_COLUMNS], data: [sample] });`
);

fs.writeFileSync('lib/csv-import.ts', code);
