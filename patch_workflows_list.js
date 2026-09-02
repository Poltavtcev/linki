const fs = require('fs');

let code = fs.readFileSync('pages/workflows/index.tsx', 'utf8');

code = code.replace(
  "MAX(CASE WHEN r.status IN ('running','paused') THEN r.status ELSE NULL END) as active_status",
  "(SELECT status FROM runs r2 WHERE r2.workflow_id = r.workflow_id ORDER BY created_at DESC LIMIT 1) as active_status"
);

code = code.replace(
  'const isPaused = w.active_status === "paused";',
  'const isPaused = w.active_status === "paused";\n            const isCompleted = w.active_status === "completed";'
);

code = code.replace(
  `                      {isPaused && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-warning/15 text-warning shrink-0">
                          Paused
                        </span>
                      )}`,
  `                      {isPaused && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-warning/15 text-warning shrink-0">
                          Paused
                        </span>
                      )}
                      {isCompleted && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-success/10 border border-success/20 text-success shrink-0">
                          Completed
                        </span>
                      )}`
);

fs.writeFileSync('pages/workflows/index.tsx', code);
