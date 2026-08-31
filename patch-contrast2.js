const fs = require('fs');
let code = fs.readFileSync('styles/globals.css', 'utf8');

code = code.replace(
  /--color-base-200: #f9f9f8;/g,
  `--color-base-200: #fdfdfd;`
);

code = code.replace(
  /--color-base-300: #f0f0ee;/g,
  `--color-base-300: #f6f6f6;`
);

code = code.replace(
  /--color-neutral: #efefed;/g,
  `--color-neutral: #f6f6f6;`
);

fs.writeFileSync('styles/globals.css', code);
