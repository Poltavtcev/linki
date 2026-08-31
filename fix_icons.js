const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

code = code.replace(
  /email: <RiMailLine size=\{15\} \/>,/,
  'email: <RiMailLine size={15} />,\n  integration: <RiPlugLine size={15} />,'
);

code = code.replace(
  /email: "Email",/,
  'email: "Email",\n  integration: "Integration",'
);

fs.writeFileSync('pages/workflows/[id].tsx', code);
