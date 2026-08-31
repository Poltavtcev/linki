const fs = require('fs');
let code = fs.readFileSync('lib/integrations/runner.ts', 'utf8');

code = code.replace(/if \(\!resObj\.ok\) throw new Error\(\`\\\$\\{resObj\.status\\} \\\$\\{resObj\.statusText\\}: \\\$\\{typeof data === 'string' \? data\.slice\(0, 50\) : JSON\.stringify\(data\)\.slice\(0, 50\)\\\}\`\);/g, 
  `if (!resObj.ok) {
            const err = new Error(\`\${resObj.status} \${resObj.statusText}: \${typeof data === 'string' ? data.slice(0, 50).replace(/\\n/g, '') : JSON.stringify(data).slice(0, 50)}\`);
            (err as any).response = res;
            throw err;
          }`
);

fs.writeFileSync('lib/integrations/runner.ts', code);
