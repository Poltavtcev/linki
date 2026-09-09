import { getSessionPage } from "../lib/linkedin/session";
import { getDb } from "../lib/db";

async function run() {
  const db = getDb();
  const runState = db.prepare("SELECT account_id FROM runs LIMIT 1").get() as any;
  if (!runState) return console.log("No account id");
  const accountId = runState.account_id;

  const page = await getSessionPage(accountId);
  try {
    const url = "https://www.linkedin.com/in/marcin-golis-0253444b/";
    console.log(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
    await page.waitForTimeout(4000);
    console.log("Current URL after navigation:", page.url());

    const topCard = page.locator("main section:has(h1):visible").first();
    const hasTopCard = await topCard.count() > 0;
    console.log("Has Top Card:", hasTopCard);

    if (hasTopCard) {
      const buttons = await topCard.locator('button, a, [role="button"]').all();
      console.log(`Found ${buttons.length} actionable elements in top card:`);
      for (const btn of buttons) {
        if (!(await btn.isVisible())) continue;
        const text = await btn.innerText().catch(() => "");
        const aria = await btn.getAttribute("aria-label").catch(() => "");
        const className = await btn.getAttribute("class").catch(() => "");
        console.log(`- Text: "${text.replace(/\n/g, "\\n")}" | Aria: "${aria}" | Class: "${className}"`);
      }
    }
  } catch(e: any) {
    console.error(e.message);
  } finally {
    await page.close();
  }
}
run();
