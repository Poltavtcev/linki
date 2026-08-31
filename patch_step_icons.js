const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

code = code.replace(/email: <RiMailLine size=\{14\} \/>,/, 'email: <RiMailLine size={14} />,\n  integration: <RiPlugLine size={14} />,');
code = code.replace(/email: "bg-warning\/10 text-warning border-warning\/20",/, 'email: "bg-warning/10 text-warning border-warning/20",\n  integration: "bg-accent/10 text-accent border-accent/20",');

fs.writeFileSync('pages/workflows/[id].tsx', code);
