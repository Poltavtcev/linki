const fs = require('fs');

// Patch inbox-sync.ts
let syncCode = fs.readFileSync('lib/linkedin/inbox-sync.ts', 'utf8');
syncCode = syncCode.replace(
  'console.log(`[inbox-sync] Skipped (normalize): ${normalized.reason} - ${JSON.stringify(value)}`);',
  '// console.log(`[inbox-sync] Skipped (normalize): ${normalized.reason}`);'
);
syncCode = syncCode.replace(
  'console.log(`[inbox-sync] Skipped (resolve): ${resolution.reason} - ${JSON.stringify(normalized)}`);',
  '// console.log(`[inbox-sync] Skipped (resolve): ${resolution.reason}`);'
);
syncCode = syncCode.replace(
  'console.log(`[inbox-sync] Skipped message: ${reason} (DB ERROR: ${errMsg}) - ${JSON.stringify(normalized)}`);',
  'console.warn(`[inbox-sync] Skipped message: ${reason} (DB ERROR: ${errMsg})`);'
);
syncCode = syncCode.replace(
  'console.log(`[inbox-sync] Total skipped in this batch: ${result.skipped.length}`);',
  '// console.log(`[inbox-sync] Total skipped in this batch: ${result.skipped.length}`);'
);
fs.writeFileSync('lib/linkedin/inbox-sync.ts', syncCode);

// Patch inbox-observer.ts
let obsCode = fs.readFileSync('lib/linkedin/inbox-observer.ts', 'utf8');
obsCode = obsCode.replace(
  'console.log(`[observer] Captured ${observations.length} observations from network.`);',
  '// console.log(`[observer] Captured ${observations.length} observations from network.`);'
);
fs.writeFileSync('lib/linkedin/inbox-observer.ts', obsCode);
