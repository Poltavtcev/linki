const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

if (!code.includes('RiGroupLine')) {
  code = code.replace(
    `import {`,
    `import { RiGroupLine } from "react-icons/ri";\nimport {`
  );
}

fs.writeFileSync('pages/workflows/[id].tsx', code);
