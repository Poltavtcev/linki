import { getSessionContext } from "./lib/linkedin/session";
import { getDb } from "./lib/db";

async function run() {
  const account = getDb().prepare("SELECT id FROM accounts WHERE is_authenticated = 1 LIMIT 1").get() as any;
  if (!account) return console.log("no account");
  
  const ctx = await getSessionContext(account.id);
  const page = await ctx.newPage();

  await page.goto("https://www.linkedin.com/in/poltavcev/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  
  const codeBlocks = await page.$$eval("code", (nodes) => nodes.map(n => n.textContent));
  let jsonExtracted = null;
  for (const block of codeBlocks) {
    if (block && block.includes("fsd_profile")) {
      jsonExtracted = true;
      const parsed = JSON.parse(block);
      console.log("Embedded code block found with profile data!");
      console.log(JSON.stringify(parsed, null, 2).substring(0, 1500));
      break;
    }
  }

  await page.close();
  console.log("Done");
  process.exit(0);
}
run();
