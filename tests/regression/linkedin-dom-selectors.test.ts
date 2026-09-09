import { test, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, Page } from 'playwright';
import { SEND_BUTTON_SELECTOR } from '../../lib/linkedin/message';

const DOM_A = `
  <button class="generic-submit" type="submit">Generic</button>
  <div id="interop-outlet">
    <template shadowrootmode="open">
      <button class="msg-form__send-button" type="submit">Send</button>
    </template>
  </div>
`;

function getHtml(bodyContent: string) {
  return `
    <!DOCTYPE html>
    <html>
      <head></head>
      <body>
        ${bodyContent}
        <script>
          (function attachShadowRoots(root) {
            root.querySelectorAll("template[shadowrootmode]").forEach(template => {
              const mode = template.getAttribute("shadowrootmode");
              const shadowRoot = template.parentNode.attachShadow({ mode });
              shadowRoot.appendChild(template.content);
              template.remove();
              attachShadowRoots(shadowRoot);
            });
          })(document);
        </script>
      </body>
    </html>
  `;
}

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch();
  page = await browser.newPage();
});

afterAll(async () => {
  if (browser) {
    await browser.close();
  }
});

test('Test A - Selector Regression', async () => {
  await page.setContent(getHtml(DOM_A));
  const badSelector = page.locator("button.msg-form__send-button:visible, button[type='submit']:visible").first();
  const badText = await badSelector.textContent();
  const goodSelector = page.locator(SEND_BUTTON_SELECTOR).first();
  const goodText = await goodSelector.textContent();
  
  expect(badText).toBe('Generic');
  expect(goodText).toBe('Send');
});
