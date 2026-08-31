const fs = require('fs');
let code = fs.readFileSync('pages/_app.tsx', 'utf8');

code = code.replace(
  /themes=\{\['notion', 'notion-light'\]\} value=\{\{ dark: 'notion', light: 'notion-light' \}\}/,
  `value={{ dark: 'notion', light: 'notion-light' }}`
);

fs.writeFileSync('pages/_app.tsx', code);
