import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { getSessionPage } from "./lib/linkedin/session";

const ACCOUNT_ID = "2f759b56-56d3-4ca0-a10f-ec96c1cd5e2c"; 

async function run() {
  const page = await getSessionPage(ACCOUNT_ID);
  
  await page.goto("https://www.linkedin.com/mynetwork/invitation-manager/sent/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  
  const text = await page.evaluate(() => document.body.innerText);
  console.log("Body text contains 'No sent invitations' or 'Ewa':");
  console.log(text.includes("No sent invitations") ? "NO INVITATIONS" : text.includes("Ewa") ? "EWA IS THERE" : "SOMETHING ELSE");
  
  await page.close();
  process.exit(0);
}
run();
