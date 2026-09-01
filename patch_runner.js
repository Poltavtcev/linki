const fs = require('fs');
let code = fs.readFileSync('lib/linkedin/runner.ts', 'utf8');

const anchor = `    } else if (step.step_type === "integration") {
      await executeIntegrationStep(db, runId, tr, target, step, steps);
    }`;

const replacement = `    } else if (step.step_type === "integration") {
      await executeIntegrationStep(db, runId, tr, target, step, steps);
    } else if (step.step_type === "change_status") {
      let statusId = "lead";
      try {
        if (step.config) {
          const cfg = JSON.parse(step.config);
          if (cfg && cfg.status_id) statusId = cfg.status_id;
        }
      } catch(e) {}
      
      db.prepare("UPDATE targets SET lead_status = ? WHERE id = ?").run(statusId, target.id);
      log(db, runId, target.id, "info", \`Updated CRM status to \${statusId}\`);
      trAdvance(db, tr, steps);
    }`;

if (code.includes(anchor)) {
  code = code.replace(anchor, replacement);
  fs.writeFileSync('lib/linkedin/runner.ts', code);
}
