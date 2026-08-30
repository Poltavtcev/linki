import type { Page } from "playwright";
import { log } from "./runner";
import { getDb } from "@/lib/db";

function parseAgeToDays(text: string): number | null {
  const match = text.match(/(\d+)\s+(hour|day|week|month|year)s?/i);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === "hour") return 0;
  if (unit === "day") return num;
  if (unit === "week") return num * 7;
  if (unit === "month") return num * 30;
  if (unit === "year") return num * 365;
  return null;
}

export async function withdrawOldInvitations(
  page: Page,
  accountId: string,
  olderThanDays: number,
  runId: string
) {
  const db = getDb();
  
  await page.goto("https://www.linkedin.com/mynetwork/invitation-manager/sent/", {
    waitUntil: "domcontentloaded",
  });
  
  await page.waitForTimeout(3000);
  
  let withdrawnCount = 0;
  let scrollAttempts = 0;
  
  while (scrollAttempts < 50) { // Safety limit
    // Re-evaluate the whole list every time because the DOM mutates on withdraw
    const targetToWithdraw = await page.evaluate((olderThan) => {
      const elements = Array.from(document.querySelectorAll("*"));
      const withdrawButtons = elements.filter(el => el.getAttribute("aria-label")?.toLowerCase().startsWith("withdraw"));
      
      for (let i = 0; i < withdrawButtons.length; i++) {
        const btn = withdrawButtons[i];
        const container = btn.closest("li");
        if (!container) continue;
        
        const textSpans = Array.from(container.querySelectorAll("span")).map(s => s.textContent);
        const sentSpan = textSpans.find(t => t?.toLowerCase().includes("sent") && t?.toLowerCase().includes("ago"));
        
        if (!sentSpan) continue;
        
        // Inline parseAgeToDays logic since we are in browser context
        const match = sentSpan.match(/(\d+)\s+(hour|day|week|month|year)s?/i);
        if (!match) continue;
        
        const num = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        let ageDays = 0;
        if (unit === "hour") ageDays = 0;
        if (unit === "day") ageDays = num;
        if (unit === "week") ageDays = num * 7;
        if (unit === "month") ageDays = num * 30;
        if (unit === "year") ageDays = num * 365;
        
        if (ageDays >= olderThan) {
           const link = container.querySelector("a[href*='/in/']");
           const url = link ? link.getAttribute("href") : null;
           return { index: i, url, ageDays };
        }
      }
      return null;
    }, olderThanDays);

    if (targetToWithdraw) {
      log(db, runId, null, "info", `Withdrawing invitation to ${targetToWithdraw.url} (Age: ${targetToWithdraw.ageDays} days)`);
      
      const withdrawBtn = page.locator("[aria-label^='Withdraw'], [aria-label^='withdraw']").nth(targetToWithdraw.index);
      
      if (await withdrawBtn.count() > 0) {
         // ensure it is in view before clicking to prevent errors
         await withdrawBtn.scrollIntoViewIfNeeded();
         await withdrawBtn.click();
         await page.waitForTimeout(1500);
         
         const confirmBtn = page.locator('[role="dialog"] button, dialog button').filter({ hasText: /Withdraw/i }).first();
         if (await confirmBtn.count() > 0) {
            await confirmBtn.click();
            await page.waitForTimeout(2000);
            withdrawnCount++;
            
            if (targetToWithdraw.url) {
              const vanity = targetToWithdraw.url.match(/\/in\/([^/?#]+)/)?.[1]?.toLowerCase();
              if (vanity) {
                 db.prepare("UPDATE targets SET degree = NULL, connected_at = NULL, connection_requested_at = NULL WHERE linkedin_url LIKE ? AND account_id = ?").run(`%${vanity}%`, accountId);
              }
            }
            // Reset scroll attempts since we made progress
            scrollAttempts = 0;
            continue; // Loop again from the top
         } else {
            await page.keyboard.press("Escape");
         }
      }
    }
    
    // If no target found in current view, scroll down to load more
    const countBefore = await page.evaluate(() => document.querySelectorAll("[aria-label^='Withdraw'], [aria-label^='withdraw']").length);
    
    await page.evaluate(() => {
      const workspace = document.getElementById("workspace");
      if (workspace) workspace.scrollTop = workspace.scrollHeight;
      else window.scrollTo(0, document.body.scrollHeight);
    });
    
    await page.waitForTimeout(2000);
    const countAfter = await page.evaluate(() => document.querySelectorAll("[aria-label^='Withdraw'], [aria-label^='withdraw']").length);
    
    if (countAfter === countBefore) {
       // Reached the end of the list
       break;
    }
    
    scrollAttempts++;
  }
  
  return withdrawnCount;
}
