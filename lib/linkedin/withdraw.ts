import type { Page } from "playwright";
import { log } from "./runner";
import { getDb } from "@/lib/db";

export async function withdrawOldInvitations(
  page: Page,
  accountId: string,
  olderThanDays: number,
  runId: string | null
) {
  const db = getDb();
  console.log(`[withdraw] Starting check for account=${accountId}, olderThan=${olderThanDays} days. Run=${runId}`);
  
  await page.goto("https://www.linkedin.com/mynetwork/invitation-manager/sent/", {
    waitUntil: "domcontentloaded",
  });
  
  await page.waitForTimeout(3000);
  
  let withdrawnCount = 0;
  let scrollAttempts = 0;
  
  while (scrollAttempts < 50) {
        
        const targetToWithdraw = await page.evaluate((olderThan) => {
      const withdrawButtons = Array.from(document.querySelectorAll("[aria-label^='Withdraw'], [aria-label^='withdraw'], [aria-label^='Відкликати'], [aria-label^='відкликати'], [aria-label^='Отозвать'], [aria-label^='отозвать']"));
      
      for (let i = 0; i < withdrawButtons.length; i++) {
        const btn = withdrawButtons[i];
        let container = null;
        let cur = btn.parentElement;
        while(cur) {
          const links = cur.querySelectorAll("a[href*='/in/']");
          if (links.length > 0 && links.length <= 3) {
             const txt = cur.textContent?.toLowerCase() || "";
             if (txt.includes("ago") || txt.includes("тому") || txt.includes("назад") || txt.includes("sent") || txt.includes("відправлено") || txt.includes("отправлено")) {
                container = cur;
                break;
             }
          }
          if (links.length > 3) break;
          cur = cur.parentElement;
        }
        
        if (!container) continue;
        
        const textSpans = Array.from(container.querySelectorAll("span")).map(s => s.textContent);
        const link = container.querySelector("a[href*='/in/']");
        const url = link ? link.getAttribute("href") : null;
        
        const sentSpan = textSpans.find(t => {
          const l = t?.toLowerCase() || "";
          return l.includes("ago") || l.includes("тому") || l.includes("назад");
        });
        
        let ageDays = null;
        if (sentSpan) {
          const l = sentSpan.toLowerCase();
          const match = l.match(/(\d+)\s*(hour|day|week|month|year|год|дн|тиж|нед|міс|мес|рік|рок|лет)/i);
          if (match) {
            const num = parseInt(match[1]);
            const unit = match[2];
            
            if (unit.startsWith("hour") || unit.startsWith("год")) ageDays = 0;
            else if (unit.startsWith("day") || unit.startsWith("дн")) ageDays = num;
            else if (unit.startsWith("week") || unit.startsWith("тиж") || unit.startsWith("нед")) ageDays = num * 7;
            else if (unit.startsWith("month") || unit.startsWith("міс") || unit.startsWith("мес")) ageDays = num * 30;
            else if (unit.startsWith("year") || unit.startsWith("рік") || unit.startsWith("рок") || unit.startsWith("лет")) ageDays = num * 365;
          }
        }
        
        if (ageDays !== null && ageDays >= olderThan) {
           return { index: i, url, ageDays };
        }
      }
      return null;
    }, olderThanDays);

    // Print what we saw on this pass
    
    if (targetToWithdraw) {
      const target = targetToWithdraw;
            log(db, runId, null, "info", `Withdrawing invitation to ${target.url} (Age: ${target.ageDays} days)`);
      
      const withdrawBtn = page.locator("[aria-label^='Withdraw'], [aria-label^='withdraw'], [aria-label^='Відкликати'], [aria-label^='Отозвать']").nth(target.index);
      
      if (await withdrawBtn.count() > 0) {
         await withdrawBtn.scrollIntoViewIfNeeded();
         await withdrawBtn.click();
         await page.waitForTimeout(1500);
         
         const confirmBtn = page.locator('[role="dialog"] button, dialog button').filter({ hasText: /(Withdraw|Відкликати|Отозвать)/i }).first();
         if (await confirmBtn.count() > 0) {
            await confirmBtn.click();
            await page.waitForTimeout(2000);
            withdrawnCount++;
                        
            if (target.url) {
              const vanity = target.url.match(/\/in\/([^/?#]+)/)?.[1]?.toLowerCase();
              if (vanity) {
                 db.prepare("UPDATE targets SET degree = NULL, connected_at = NULL, connection_requested_at = NULL WHERE linkedin_url LIKE ?").run(`%${vanity}%`);
              }
            }
            scrollAttempts = 0;
            continue; 
         } else {
            console.warn(`[withdraw] ---> ERROR: Confirm button not found in modal!`);
            await page.keyboard.press("Escape");
         }
      } else {
         console.warn(`[withdraw] ---> ERROR: Withdraw button not found on page despite DOM match!`);
      }
    } else {
          }
    
    const countBefore = await page.evaluate(() => document.querySelectorAll("[aria-label^='Withdraw'], [aria-label^='withdraw'], [aria-label^='Відкликати'], [aria-label^='Отозвать']").length);
    
    await page.evaluate(() => {
      const workspace = document.getElementById("workspace");
      if (workspace) workspace.scrollTop = workspace.scrollHeight;
      else window.scrollTo(0, document.body.scrollHeight);
    });
    
    await page.waitForTimeout(2000);
    const countAfter = await page.evaluate(() => document.querySelectorAll("[aria-label^='Withdraw'], [aria-label^='withdraw'], [aria-label^='Відкликати'], [aria-label^='Отозвать']").length);
    
        
    if (countAfter === countBefore) {
              break;
    }
    
    scrollAttempts++;
  }
  
  console.log(`[withdraw] Finished check for account=${accountId}. Total withdrawn: ${withdrawnCount}`);
  return withdrawnCount;
}
