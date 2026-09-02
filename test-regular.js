const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

async function run() {
  const accountId = "2f759b56-56d3-4ca0-a10f-ec96c1cd5e2c";
  const profileDir = path.join(process.cwd(), ".sessions", accountId);
  
  const ctx = await chromium.launchPersistentContext(profileDir, { headless: true });
  const page = await ctx.newPage();
  
  const captured = [];
  
  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("graphql") || url.includes("voyager")) {
      try {
        const text = await res.text();
        if (text.includes("Poltav") || text.includes("Linki") || text.includes("position") || text.includes("headline")) {
           captured.push({ url, body: text });
        }
      } catch (e) {}
    }
  });
  
  console.log("Visiting profile...");
  try {
    await page.goto("https://www.linkedin.com/in/poltavcev/", { waitUntil: "domcontentloaded", timeout: 20000 });
  } catch(e) {}
  
  console.log("Waiting 3s for redirect...");
  await page.waitForTimeout(3000);

  console.log("Scrolling...");
  try { await page.evaluate(() => window.scrollBy(0, 1000)); } catch(e) {}
  await page.waitForTimeout(2000);
  try { await page.evaluate(() => window.scrollBy(0, 1000)); } catch(e) {}
  await page.waitForTimeout(2000);

  fs.writeFileSync("regular-profile-dump.json", JSON.stringify(captured, null, 2));
  console.log(`Captured ${captured.length} relevant GraphQL/Voyager responses.`);
  
  await ctx.close();
  process.exit(0);
}
run().catch(console.error);
