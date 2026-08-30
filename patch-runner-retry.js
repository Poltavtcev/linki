const fs = require('fs');
let content = fs.readFileSync('lib/linkedin/runner.ts', 'utf8');

content = content.replace(
  /async function tickSync\(db: ReturnType<typeof getDb>\): Promise<void> \{/g,
  `async function tickSync(db: ReturnType<typeof getDb>): Promise<void> {
  try {
    const premium = require("@/ee").premium;
    if (premium?.replies?.retryFailed) {
      await premium.replies.retryFailed();
    }
  } catch (e) {}`
);

fs.writeFileSync('lib/linkedin/runner.ts', content);
