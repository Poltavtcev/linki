const fs = require('fs');
let content = fs.readFileSync('lib/linkedin/runner.ts', 'utf8');

// We need to delete the original sync blocks inside tickActions
const startIdx = content.indexOf('  // Get ALL authenticated accounts for account-level syncs');
const endIdx = content.indexOf('  // Auto-complete runs where ALL track-runs across all profiles are terminal');

if (startIdx !== -1 && endIdx !== -1) {
    content = content.substring(0, startIdx) + content.substring(endIdx);
    fs.writeFileSync('lib/linkedin/runner.ts', content);
    console.log("Cleanup done");
} else {
    console.log("Not found");
}
