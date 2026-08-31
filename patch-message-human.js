const fs = require('fs');
let content = fs.readFileSync('lib/linkedin/message.ts', 'utf8');

content = content.replace(
  /await msgInput\.pressSequentially\(text, \{ delay: 10 \}\);/g,
  `// Type text with human-like realistic delays (average ~65ms per key)\n  for (const char of text) {\n    await msgInput.pressSequentially(char, { delay: 15 + Math.random() * 40 });\n    await page.waitForTimeout(30 + Math.random() * 50);\n  }`
);

fs.writeFileSync('lib/linkedin/message.ts', content);
