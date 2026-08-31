const fs = require('fs');
let code = fs.readFileSync('pages/settings.tsx', 'utf8');
code = code.replace(
  /placeholder: "Snov\.io API key",/,
  'placeholder: "Client ID : Client Secret (separated by colon)",'
);
fs.writeFileSync('pages/settings.tsx', code);
