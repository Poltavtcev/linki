const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

// 1. Add to basePages arrays
code = code.replace(
  /\? \["prompt", "linkedin-steps", "email-steps"\]/g,
  '? ["prompt", "linkedin-steps", "email-steps", "integration-steps"]'
);
code = code.replace(
  /\? \["prompt", "linkedin-steps", "email-steps", "account"\]/g,
  '? ["prompt", "linkedin-steps", "email-steps", "integration-steps", "account"]'
);
code = code.replace(
  /: \["prospects", "prompt", "linkedin-steps", "email-steps", "account", "summary"\];/g,
  ': ["prospects", "prompt", "linkedin-steps", "email-steps", "integration-steps", "account", "summary"];'
);

// 2. Add to canGoTo
code = code.replace(
  /if \(p === "prompt" \|\| p === "linkedin-steps" \|\| p === "email-steps"\) return true;/g,
  'if (p === "prompt" || p === "linkedin-steps" || p === "email-steps" || p === "integration-steps") return true;'
);
code = code.replace(
  /if \(p === "email-steps"\) return prospectsReady;/g,
  'if (p === "email-steps") return prospectsReady;\n    if (p === "integration-steps") return prospectsReady;'
);
code = code.replace(
  /if \(isStepsOnly\) return p === "prompt" \|\| p === "linkedin-steps" \|\| p === "email-steps";/g,
  'if (isStepsOnly) return p === "prompt" || p === "linkedin-steps" || p === "email-steps" || p === "integration-steps";'
);

// 3. Render logic
code = code.replace(
  /\{\(page === "linkedin-steps" \|\| page === "email-steps"\) && \(\(\) => \{/g,
  '{(page === "linkedin-steps" || page === "email-steps" || page === "integration-steps") && (() => {'
);

code = code.replace(
  /const track: Track = page === "linkedin-steps" \? "linkedin" : "email";/g,
  'const track: Track = page === "linkedin-steps" ? "linkedin" : page === "email-steps" ? "email" : "integration";'
);

// 4. Save steps only button render condition
code = code.replace(
  /page === "linkedin-steps" \|\| page === "email-steps"/g,
  'page === "linkedin-steps" || page === "email-steps" || page === "integration-steps"'
);

fs.writeFileSync('pages/workflows/[id].tsx', code);
