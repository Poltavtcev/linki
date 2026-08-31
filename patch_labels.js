const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

code = code.replace(
  /"email-steps": "Email Steps",/,
  '"email-steps": "Email Steps",\n    "integration-steps": "Integration Steps",'
);

code = code.replace(
  /"email-steps": <RiMailLine size=\{14\} \/>,/,
  '"email-steps": <RiMailLine size={14} />,\n    "integration-steps": <RiPlugLine size={14} />,'
);

fs.writeFileSync('pages/workflows/[id].tsx', code);
