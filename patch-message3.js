const fs = require('fs');
let content = fs.readFileSync('lib/linkedin/message.ts', 'utf8');

content = content.replace(
  /await moreBtn\.click\(\);\n          await page\.waitForTimeout\(1000\);/g,
  `await moreBtn.click();\n          await mainArea.locator('div.artdeco-dropdown__content, div[role="menu"]').first().waitFor({ state: "visible", timeout: 5000 }).catch(() => {});`
);
fs.writeFileSync('lib/linkedin/message.ts', content);
