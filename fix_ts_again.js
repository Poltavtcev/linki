const fs = require('fs');
let code = fs.readFileSync('lib/linkedin/runner.ts', 'utf8');

code = code.replace(
  /\)\.all\(run\.run_id\);/,
  ').all(run.run_id) as Array<{ id: string; run_profile_id: string; track: string }>;'
);

fs.writeFileSync('lib/linkedin/runner.ts', code);
