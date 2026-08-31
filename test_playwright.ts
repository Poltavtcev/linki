import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Try to load a generic page to ensure it works
  await page.goto('https://www.google.com');
  console.log(await page.title());
  await browser.close();
}
run();
