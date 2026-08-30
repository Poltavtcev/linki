const fs = require('fs');
let content = fs.readFileSync('lib/linkedin/inbox-sync.ts', 'utf8');

content = content.replace(
  /function resolveTarget\(\n  db: Database\.Database,\n  accountId: string,\n  normalized: NormalizedObservation,\n\): TargetResolution \| \{ reason: LinkedInInboxSkipReason \} \{\n  const scoped = loadScopedTargets\(db, accountId\);\n  const allTargets = loadAllTargets\(db\);/g,
  `function resolveTarget(
  db: Database.Database,
  accountId: string,
  normalized: NormalizedObservation,
  scoped: ScopedTarget[],
  allTargets: ScopedTarget[]
): TargetResolution | { reason: LinkedInInboxSkipReason } {`
);

content = content.replace(
  /    const resolution = resolveTarget\(db, accountId, normalized\);/g,
  `    const resolution = resolveTarget(db, accountId, normalized, scopedTargets, allTargets);`
);

content = content.replace(
  /  const result: LinkedInInboxCaptureResult = \{ captured: 0, duplicates: 0, skipped: \[\] \};\n\n  for \(const value of observations\) \{/g,
  `  const result: LinkedInInboxCaptureResult = { captured: 0, duplicates: 0, skipped: [] };
  const scopedTargets = loadScopedTargets(db, accountId);
  const allTargets = loadAllTargets(db);

  for (const value of observations) {`
);

fs.writeFileSync('lib/linkedin/inbox-sync.ts', content);
