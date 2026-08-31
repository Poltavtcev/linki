const { chromium } = require("playwright");

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: "cookies.json" // Wait, I don't have cookies.json
  });
  // Without cookies, this won't work.
}
