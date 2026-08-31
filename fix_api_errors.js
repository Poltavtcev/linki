const fs = require('fs');
let code = fs.readFileSync('lib/integrations/runner.ts', 'utf8');

// Safely parse JSON
function replaceFetch(provider, url, options, jsonPath) {
  // Not using regex for everything, I'll write a general regex to replace all `await resObj.json()` with safe parsing
}

code = code.replace(/const res = \{ data: await resObj\.json\(\), status: resObj\.status \};\n\s*if \(!resObj\.ok\) throw \{ response: res \};/g, 
  `let data;
          const text = await resObj.text();
          try { data = JSON.parse(text); } catch (e) { data = text; }
          const res = { data, status: resObj.status };
          if (!resObj.ok) throw new Error(\`\${resObj.status} \${resObj.statusText}: \${typeof data === 'string' ? data.slice(0, 50) : JSON.stringify(data).slice(0, 50)}\`);`
);

code = code.replace(/log\(db, runId, target\.id, "warn", \`\$\{provider\} enrichment failed: \$\{err\.message\}\`\);/, 
  'log(db, runId, target.id, "warn", \`${provider} enrichment failed: ${err.message || JSON.stringify(err)}\`);'
);

fs.writeFileSync('lib/integrations/runner.ts', code);
