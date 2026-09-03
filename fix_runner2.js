const fs = require('fs');
let runner = fs.readFileSync('lib/linkedin/runner.ts', 'utf8');

const lines = runner.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const dailyLimit = isInmailFirst')) {
    lines[i] = lines[i].replace(/tr\.account_id/g, 'run.account_id');
  }
}
fs.writeFileSync('lib/linkedin/runner.ts', lines.join('\n'));
