const fs = require('fs');
let code = fs.readFileSync('styles/globals.css', 'utf8');

// 1. Inject nav variables into "notion" (dark)
code = code.replace(
  /--color-error: #ff6b6b;/,
  `--color-error: #ff6b6b;
  --nav-blue: #5aa2ff;
  --nav-green: #32d583;
  --nav-emerald: #34d399;
  --nav-purple: #a78bfa;
  --nav-yellow: #f4b740;
  --nav-sky: #38bdf8;
  --nav-orange: #fb923c;`
);

// 2. Inject nav variables and boost semantic colors in "notion-light"
code = code.replace(
  /--color-primary: #2382fc;/,
  `--color-primary: #005be6;`
);
code = code.replace(
  /--color-info: #5aa2ff;/,
  `--color-info: #026ada;`
);
code = code.replace(
  /--color-success: #32d583;/,
  `--color-success: #10b981;`
);
code = code.replace(
  /--color-warning: #f4b740;/,
  `--color-warning: #d97706;`
);
code = code.replace(
  /--color-error: #ff6b6b;\n\}/,
  `--color-error: #ef4444;
  --nav-blue: #026ada;
  --nav-green: #10b981;
  --nav-emerald: #059669;
  --nav-purple: #7c3aed;
  --nav-yellow: #d97706;
  --nav-sky: #0284c7;
  --nav-orange: #ea580c;
}`
);

fs.writeFileSync('styles/globals.css', code);
