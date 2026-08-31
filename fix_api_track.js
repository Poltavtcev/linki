const fs = require('fs');
let code = fs.readFileSync('pages/api/workflows/[id]/steps.ts', 'utf8');

code = code.replace(
  /const track: "linkedin" \| "email" = trackIn === "email" \|\| step_type === "email" \|\| step_type === "integration" \? "email" : "linkedin";/,
  'const track: "linkedin" | "email" | "integration" = trackIn === "integration" || step_type === "integration" ? "integration" : trackIn === "email" || step_type === "email" ? "email" : "linkedin";'
);

fs.writeFileSync('pages/api/workflows/[id]/steps.ts', code);
