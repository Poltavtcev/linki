const fs = require('fs');

// Patch pages/workflows/[id].tsx
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

code = code.replace(
  'const isPaused = activeRun?.status === "paused";',
  'const isPaused = activeRun?.status === "paused";\n  const isCompleted = activeRun?.status === "completed";'
);

code = code.replace(
  '            {!isActive && displayStats.total_prospects > 0 && (',
  `            {isCompleted && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-success/10 border border-success/20 text-success">
                Completed
              </span>
            )}
            {!isActive && !isCompleted && displayStats.total_prospects > 0 && (`
);

fs.writeFileSync('pages/workflows/[id].tsx', code);

// Patch pages/index.tsx
let indexCode = fs.readFileSync('pages/index.tsx', 'utf8');

indexCode = indexCode.replace(
  `       MAX(CASE WHEN r.status IN ('running','paused') THEN r.status ELSE NULL END) as active_status`,
  `       MAX(r.status) as active_status`
);
// Wait! MAX(r.status) might be wrong if there are multiple runs! 
// Let's use a subquery or conditional logic. If any is running -> running. Else if paused -> paused. Else if completed -> completed.
// Since SQLite MAX compares alphabetically, 'running' < 'paused' is false, 'running' > 'completed' is true. 'running' > 'paused' > 'completed'.
// So MAX() would actually return 'running' if 'running' is there!
