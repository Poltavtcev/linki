const fs = require('fs');
let content = fs.readFileSync('lib/linkedin/message.ts', 'utf8');

content = content.replace(
  /'button\.message-anywhere-button, a\[href\*="\/messaging\/compose"\], button\[aria-label\^="Message"\], button\[aria-label\^="Повідомлення"\], button:has-text\("Message"\), button:has-text\("Повідомлення"\), a:has-text\("Message"\), a:has-text\("Повідомлення"\)'/,
  "'button.message-anywhere-button, a[href*=\"/messaging/compose\"], button[aria-label^=\"Message\"], button[aria-label^=\"Повідомлення\"], button[aria-label^=\"Mensaje\"], button[aria-label^=\"Mensagem\"], button:has-text(\"Message\"), button:has-text(\"Повідомлення\"), button:has-text(\"Mensaje\"), button:has-text(\"Mensagem\"), a:has-text(\"Message\"), a:has-text(\"Повідомлення\"), a:has-text(\"Mensaje\"), a:has-text(\"Mensagem\")'"
);

content = content.replace(
  /const msgInput = page\.locator\("div\.msg-form__contenteditable"\)\.first\(\);/g,
  `const msgInput = page.locator("div.msg-form__contenteditable, div[role='textbox'][aria-label*='Message'], div[role='textbox'][aria-label*='Mensaje'], div[role='textbox'][aria-label*='Mensagem'], div[role='textbox'][aria-label*='Повідомлення']").first();`
);

content = content.replace(
  /const sendBtn = page\.locator\("button\.msg-form__send-button"\)\.first\(\);/g,
  `const sendBtn = page.locator("button.msg-form__send-button, button[type='submit']").first();`
);

content = content.replace(
  /await page\.waitForTimeout\(1000\);\n          if \(await msgInput\.count\(\) > 0\)/g,
  `await page.waitForTimeout(1000);\n          if (await msgInput.isVisible())`
);

fs.writeFileSync('lib/linkedin/message.ts', content);
