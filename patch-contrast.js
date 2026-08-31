const fs = require('fs');
let code = fs.readFileSync('styles/globals.css', 'utf8');

code = code.replace(
  /--color-base-content: #37352f;/g,
  `--color-base-content: #000000;`
);

code = code.replace(
  /--color-base-200: #f7f7f5;/g,
  `--color-base-200: #f9f9f8;`
);

code = code.replace(
  /--color-base-300: #efefed;/g,
  `--color-base-300: #f0f0ee;`
);

fs.writeFileSync('styles/globals.css', code);
