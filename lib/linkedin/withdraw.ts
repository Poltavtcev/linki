import type { Page } from "playwright";
import { log } from "./runner";
import { getDb } from "@/lib/db";

export async function withdrawOldInvitations(
  page: Page,
  accountId: string,
  olderThanDays: number,
  runId: string
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
    console.log(`[withdraw] Page scan attempt ${scrollAttempts + 1}...`);
    
    const targetToWithdraw = await page.evaluate((olderThan) => {
      const withdrawButtons = Array.from(document.querySelectorAll("[aria-label^='Withdraw'], [aria-label^='withdraw'], [aria-label^='Відкликати'], [aria-label^='відкликати'], [aria-label^='Отозвать'], [aria-label^='отозвать']"));
      
      const debugScanned: any[] = [];
      let foundTarget = null;
      
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
        
        // Debug: get all text just in case we miss the keyword
        const rawText = container.textContent?.replace(/\s+/g, ' ') || "";
        const link = container.querySelector("a[href*='/in/']");
        const url = link ? link.getAttribute("href") : null;
        
        // Find time string by looking for time units (English, Ukrainian, Russian)
        const sentSpan = textSpans.find(t => {
          const l = t?.toLowerCase() || "";
          return l.includes("ago") || l.includes("тому") || l.includes("назад");
        });
        
        let ageDays: number | null = null;
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
        
        debugScanned.push({ url, rawText, sentSpan, ageDays });
        
        if (ageDays !== null && ageDays >= olderThan && !foundTarget) {
           foundTarget = { index: i, url, ageDays };
        }
      }
      return { foundTarget, debugScanned };
    }, olderThanDays);

    // Print what we saw on this pass
    console.log(`[withdraw] Scanned ${targetToWithdraw.debugScanned.length} items on current screen.`);
    for (const item of targetToWithdraw.debugScanned) {
       console.log(`[withdraw] -> URL: ${item.url} | Age parsed: ${item.ageDays} | Raw: ${item.rawText} | Span: ${item.sentSpan}`);
    }

    if (targetToWithdraw.foundTarget) {
      const target = targetToWithdraw.foundTarget;
      console.log(`[withdraw] ---> MATCHED target for withdrawal: ${target.url} (Age: ${target.ageDays} days)`);
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
            console.log(`[withdraw] ---> Successfully clicked confirm for ${target.url}`);
            
            if (target.url) {
              const vanity = target.url.match(/\/in\/([^/?#]+)/)?.[1]?.toLowerCase();
              if (vanity) {
                 db.prepare("UPDATE targets SET degree = NULL, connected_at = NULL, connection_requested_at = NULL WHERE linkedin_url LIKE ? AND account_id = ?").run(`%${vanity}%`, accountId);
              }
            }
            scrollAttempts = 0;
            continue; 
         } else {
            console.log(`[withdraw] ---> ERROR: Confirm button not found in modal!`);
            await page.keyboard.press("Escape");
         }
      } else {
         console.log(`[withdraw] ---> ERROR: Withdraw button not found on page despite DOM match!`);
      }
    } else {
      console.log(`[withdraw] No targets older than ${olderThanDays} days found in current view. Scrolling down...`);
    }
    
    const countBefore = await page.evaluate(() => document.querySelectorAll("[aria-label^='Withdraw'], [aria-label^='withdraw'], [aria-label^='Відкликати'], [aria-label^='Отозвать']").length);
    
    await page.evaluate(() => {
      const workspace = document.getElementById("workspace");
      if (workspace) workspace.scrollTop = workspace.scrollHeight;
      else window.scrollTo(0, document.body.scrollHeight);
    });
    
    await page.waitForTimeout(2000);
    const countAfter = await page.evaluate(() => document.querySelectorAll("[aria-label^='Withdraw'], [aria-label^='withdraw'], [aria-label^='Відкликати'], [aria-label^='Отозвать']").length);
    
    console.log(`[withdraw] Scroll result: UI had ${countBefore} items, now has ${countAfter} items.`);
    
    if (countAfter === countBefore) {
       console.log(`[withdraw] Reached the end of the list. Stopping.`);
       break;
    }
    
    scrollAttempts++;
  }
  
  console.log(`[withdraw] Finished check for account=${accountId}. Total withdrawn: ${withdrawnCount}`);
  return withdrawnCount;
}
