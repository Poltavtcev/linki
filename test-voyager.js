const { chromium } = require("playwright");

async function run() {
  const accountId = "2f759b56-56d3-4ca0-a10f-ec96c1cd5e2c";
  const profileDir = require("path").join(process.cwd(), ".sessions", accountId);
  
  const ctx = await chromium.launchPersistentContext(profileDir, { headless: true });
  const page = await ctx.newPage();
  
  await page.goto("https://www.linkedin.com/in/poltavcev/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  
  const codeBlocks = await page.$$eval("code", (nodes) => nodes.map(n => n.textContent));
  for (const block of codeBlocks) {
    if (block && block.includes("com.linkedin.voyager.dash.identity.profile.Profile")) {
      const parsed = JSON.parse(block);
      if (parsed.included) {
         const profile = parsed.included.find(x => x.$type === "com.linkedin.voyager.dash.identity.profile.Profile");
         if (profile) {
           console.log("FOUND PROFILE:", profile.headline, profile.summary);
           const pos = parsed.included.find(x => x.$type === "com.linkedin.voyager.dash.identity.profile.Position");
           if (pos) {
             console.log("FOUND POSITION:", pos.title, pos.companyName, pos.description);
           }
         }
      }
    }
  }

  await ctx.close();
}
run();
