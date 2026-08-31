const fs = require('fs');
let code = fs.readFileSync('lib/integrations/runner.ts', 'utf8');

code = code.replace(
  /const res = await matchPerson\(target\.linkedin_url, apiKey\);/,
  'if (!target.linkedin_url) continue;\n          const res = await matchPerson(target.linkedin_url, apiKey);'
);

fs.writeFileSync('lib/integrations/runner.ts', code);
