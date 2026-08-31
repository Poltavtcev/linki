const fs = require('fs');
let code = fs.readFileSync('lib/integrations/runner.ts', 'utf8');

code = code.replace(
  /log\(db, runId, target\.id, "warn", \`\$\{provider\} enrichment failed: \$\{err\.message\}\`\);\n        log\(db, runId, target\.id, "warn", \`\$\{provider\} enrichment failed: \$\{err\.message\}\`\);/,
  'log(db, runId, target.id, "warn", \`${provider} enrichment failed: ${err.message}\`);'
);

fs.writeFileSync('lib/integrations/runner.ts', code);
