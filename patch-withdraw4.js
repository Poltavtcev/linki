const fs = require('fs');
let code = fs.readFileSync('lib/linkedin/withdraw.ts', 'utf8');

code = code.replace(
  /const confirmBtn = page\.locator\('\[role="dialog"\] button\.artdeco-button--primary, dialog button\.artdeco-button--primary'\)\.first\(\);/,
  `let confirmBtn = page.locator(\`[role="dialog"] button[aria-label*="\${target.name}"], dialog button[aria-label*="\${target.name}"]\`).first();
         if (await confirmBtn.count() === 0) {
            confirmBtn = page.locator('[role="dialog"] button, dialog button').filter({ hasNot: page.locator('svg') }).nth(1);
         }`
);

fs.writeFileSync('lib/linkedin/withdraw.ts', code);
