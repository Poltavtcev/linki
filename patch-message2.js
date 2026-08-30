const fs = require('fs');
let content = fs.readFileSync('lib/linkedin/message.ts', 'utf8');
content = content.replace(
  /const sendBtn = page\.locator\("button\.msg-form__send-button:visible"\)\.first\(\);/g,
  `const sendBtn = page.locator("button.msg-form__send-button:visible, button[type='submit']:visible").first();`
);
fs.writeFileSync('lib/linkedin/message.ts', content);
