const fs = require('fs');
let code = fs.readFileSync('lib/integrations/runner.ts', 'utf8');

const anchor = `if (err.response?.status === 402 || err.response?.status === 429) {`;
const replacement = `if (err.response?.status === 402 || err.response?.status === 429 || err.message?.includes('402') || err.message?.includes('429')) {`;

code = code.replace(anchor, replacement);
fs.writeFileSync('lib/integrations/runner.ts', code);
