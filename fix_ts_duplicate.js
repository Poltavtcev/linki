const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

code = code.replace(
  /\{\(page === "linkedin-steps" \|\| page === "email-steps" \|\| page === "integration-steps" \|\| page === "integration-steps"\)/g,
  '{(page === "linkedin-steps" || page === "email-steps" || page === "integration-steps")'
);

code = code.replace(
  /!isStepsOnly && !isEditMode && \(page === "linkedin-steps" \|\| page === "email-steps" \|\| page === "integration-steps" \|\| page === "integration-steps"\)/g,
  '!isStepsOnly && !isEditMode && (page === "linkedin-steps" || page === "email-steps" || page === "integration-steps")'
);

fs.writeFileSync('pages/workflows/[id].tsx', code);
