const fs = require('fs');
let code = fs.readFileSync('lib/integrations/runner.ts', 'utf8');

const anchor = `        if (!resObj.ok) {
          const data = await resObj.json();
          throw { response: { status: resObj.status, data } };
        }`;

const replacement = `        if (!resObj.ok) {
          let data;
          const text = await resObj.text();
          try { data = JSON.parse(text); } catch (e) { data = text; }
          const err = new Error(\`\${resObj.status} \${resObj.statusText}: \${typeof data === 'string' ? data.slice(0, 50).replace(/\\n/g, '') : JSON.stringify(data).slice(0, 50)}\`);
          (err as any).response = { status: resObj.status, data };
          throw err;
        }`;

code = code.replace(anchor, replacement);
fs.writeFileSync('lib/integrations/runner.ts', code);
