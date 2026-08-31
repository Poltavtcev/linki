import { chromium } from "playwright";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // We need to be logged into Next Auth. Since we don't have the session token,
  // we can't easily click the UI button. Wait! Is there an API endpoint we can hit?
  
  await browser.close();
}
run();
