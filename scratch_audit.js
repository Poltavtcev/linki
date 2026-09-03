// Just a scratchpad check for existing UI references to email-health
const { execSync } = require('child_process');
console.log(execSync('grep -rn "email-health" components/ pages/ || echo "None"').toString());
