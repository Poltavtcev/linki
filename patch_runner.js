const fs = require('fs');
let code = fs.readFileSync('lib/linkedin/runner.ts', 'utf8');

// A. Import
code = code.replace(
  /import \{ getDb \} from "@\/lib\/db";/,
  'import { getDb } from "@/lib/db";\nimport { executeIntegrationStep } from "@/lib/integrations/runner";'
);

// B. Update WorkflowStep
code = code.replace(
  /step_type: "visit" \| "connect" \| "message" \| "sales_inmail" \| "delay" \| "email";/,
  'step_type: "visit" | "connect" | "message" | "sales_inmail" | "delay" | "email" | "integration";'
);
if (!code.includes('config: string | null;')) {
  code = code.replace(
    /email_signature: string \| null;/,
    'email_signature: string | null;\n  config: string | null;'
  );
}

// C. Export trAdvance
code = code.replace(
  /function trAdvance\(db:/,
  'export function trAdvance(db:'
);

// D. Add to executeStep
const oldEmailEnd = `      trRecordContext(db, tr, { emailSubject, emailBody, emailMessageId: messageId });
      trAdvance(db, tr, steps);
      log(db, runId, target.id, "info", \`Email sent to \${name}\`);
    }`;

const newEmailEnd = `      trRecordContext(db, tr, { emailSubject, emailBody, emailMessageId: messageId });
      trAdvance(db, tr, steps);
      log(db, runId, target.id, "info", \`Email sent to \${name}\`);
    } else if (step.step_type === "integration") {
      await executeIntegrationStep(db, runId, tr, target, step, steps);
    }`;

code = code.replace(oldEmailEnd, newEmailEnd);

fs.writeFileSync('lib/linkedin/runner.ts', code);
