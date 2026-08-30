import { chromium } from "playwright";
import fs from "fs";

(async () => {
  console.log("Launching browser for API dumping...");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  let captured = 0;

  page.on("response", async (response) => {
    const url = response.url();
    // LinkedIn loads data via voyager API
    if (url.includes("voyager") && response.status() === 200) {
      try {
        const text = await response.text();
        // Heuristic: looks for keywords related to sent invitations
        if ((text.includes("sentTime") || text.includes("createdAt")) && text.includes("urn:li:fs")) {
          const outPath = `linkedin_dump_${Date.now()}.json`;
          fs.writeFileSync(outPath, text);
          console.log(`\n[SUCCESS] Captured potential payload! Saved to ${outPath}`);
          captured++;
        }
      } catch (e) {
        // Ignore read errors
      }
    }
  });

  console.log("INSTRUCTIONS:");
  console.log("1. Log in to LinkedIn.");
  console.log("2. Go to My Network -> Manage My Network -> Sent.");
  console.log("3. The script will intercept the network response and save it to a JSON file.");
  console.log("4. Browser will auto-close in 3 хвилин.");
  
  await page.goto("https://www.linkedin.com/mynetwork/invitation-manager/sent/");
  
  await page.waitForTimeout(180000);
  await browser.close();
  
  if (captured === 0) {
    console.log("No relevant payload captured. The endpoint structure might be different.");
  }
})();
