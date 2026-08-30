import { chromium } from "playwright";
import { getDb } from "../lib/db";
import fs from "fs";
import path from "path";

async function main() {
  const db = getDb();
  
  // Get mariia-solodar's account from DB
  const account = db.prepare("SELECT * FROM accounts WHERE name LIKE '%ariia%' OR email LIKE '%ariia%'").get() as any;
  
  // If not found, just grab the first authenticated account
  const targetAccount = account || (db.prepare("SELECT * FROM accounts WHERE is_authenticated = 1").get() as any);
  
  if (!targetAccount || !targetAccount.cookies_json) {
    console.error("Account not found or no cookies.");
    process.exit(1);
  }
  
  const cookies = JSON.parse(targetAccount.cookies_json);
  
  console.log("Launching browser for debugging...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(cookies);
  
  const page = await context.newPage();
  
  console.log("Navigating to target profile...");
  await page.goto("https://www.linkedin.com/in/poltavcev/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000); // let UI settle
  
  console.log("Opening message modal...");
  const btn = page.locator("button.pvs-profile-actions__action:has-text('Message'), button.pv-s-profile-actions--message").first();
  if (await btn.isVisible()) {
    await btn.click();
    await page.waitForTimeout(3000);
  } else {
    console.log("Could not find message button on profile.");
  }
  
  // Now try to find the compose box
  const msgInput = page.locator("div.msg-form__contenteditable").first();
  if (await msgInput.isVisible()) {
    console.log("Found message input, typing test message...");
    await msgInput.click();
    await msgInput.pressSequentially("Test message for debugging", { delay: 10 });
    await page.waitForTimeout(2000); // let React update
  } else {
    console.log("Message input NOT visible!");
  }
  
  console.log("Taking screenshot and saving DOM...");
  const artifactDir = "/Users/admin/.gemini/antigravity-cli/brain/3ff57a92-64a6-4522-a352-12acd6c88cf3/scratch";
  if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
  
  await page.screenshot({ path: path.join(artifactDir, "linkedin-debug.png"), fullPage: true });
  
  // Also extract the exact HTML of the form
  const formHtml = await page.locator("form.msg-form, div.msg-form").first().evaluate(el => el.outerHTML).catch(() => "Form not found");
  fs.writeFileSync(path.join(artifactDir, "linkedin-form.html"), formHtml);
  
  console.log("Screenshot saved to: " + path.join(artifactDir, "linkedin-debug.png"));
  await browser.close();
}

main().catch(console.error);
