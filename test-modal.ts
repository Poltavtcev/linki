import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { getSessionPage } from "./lib/linkedin/session";
import fs from "fs";

const ACCOUNT_ID = "2f759b56-56d3-4ca0-a10f-ec96c1cd5e2c"; 

async function run() {
  const page = await getSessionPage(ACCOUNT_ID);
  
  await page.goto("https://www.linkedin.com/mynetwork/invitation-manager/sent/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  
  const withdrawBtn = page.locator('button, a').filter({ hasText: /Withdraw|Відкликати/i }).first();
  await withdrawBtn.click();
  await page.waitForTimeout(2000);
  
  const dialogHtml = await page.locator('[role="dialog"], dialog, .artdeco-modal').first().innerHTML();
  fs.writeFileSync("audit-modal-dom.html", dialogHtml);
  
  await page.close();
  process.exit(0);
}
run();
