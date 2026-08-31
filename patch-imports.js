const fs = require('fs');
let code = fs.readFileSync('pages/companies/[id].tsx', 'utf8');

code = code.replace(
  /import Head from "next\/head";/,
  `import Head from "next/head";\nimport { useState, useEffect } from "react";`
);

code = code.replace(
  /RiArrowLeftLine, /g,
  `RiArrowLeftLine, RiAddLine, RiSearchLine, `
);

// We need to type 'c' in map to resolve the implicit any
code = code.replace(
  /\{searchResults\.map\(c => \(/,
  `{searchResults.map((c: any) => (`
);

fs.writeFileSync('pages/companies/[id].tsx', code);
