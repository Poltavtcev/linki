const fs = require('fs');

const code = `import type { Page } from "playwright";
import { log } from "./runner";
import { getDb } from "@/lib/db";

export async function withdrawOldInvitations(
  page: Page,
  accountId: string,
  olderThanDays: number,
  runId: string | null
) {
  const db = getDb();
  console.log(\`[withdraw] Starting check for account=\${accountId}, olderThan=\${olderThanDays} days. Run=\${runId}\`);
  
  await page.goto("https://www.linkedin.com/mynetwork/invitation-manager/sent/", {
    waitUntil: "domcontentloaded",
  });
  
  await page.waitForTimeout(3000);
  
  let withdrawnCount = 0;
  let scrollAttempts = 0;
  
  while (scrollAttempts < 50) {
    // 1. Find the target and return its DOM element handle directly!
    const targetHandle = await page.evaluateHandle((olderThan) => {
      const profileLinks = Array.from(document.querySelectorAll('a[href*="/in/"]'));
      const cards = new Set();
      
      for (const link of profileLinks) {
         let cur = link.parentElement;
         while(cur && cur.tagName !== 'BODY') {
            const txt = cur.textContent?.toLowerCase() || "";
            const hasTime = /(\\d+)\\s*(hour|day|week|month|year|год|дн|тиж|нед|міс|мес|рік|рок|лет|jour|sem|mois|an|dia|mes|año|tag|woch|mona|jahr)/i.test(txt);
            const linksCount = cur.querySelectorAll('a[href*="/in/"]').length;
            
            if (hasTime && linksCount <= 3) {
               cards.add(cur);
               break;
            }
            if (linksCount > 3) break;
            cur = cur.parentElement;
         }
      }
      
      const cardsArray = Array.from(cards) as Element[];
      
      for (let i = 0; i < cardsArray.length; i++) {
        const card = cardsArray[i];
        const nameEl = card.querySelector('span[dir="ltr"], .invitation-card__title, span[aria-hidden="true"]');
        const name = nameEl ? nameEl.textContent?.trim().split(' ')[0] : '';
        const textContent = card.textContent?.toLowerCase() || "";
        
        let ageDays = null;
        const match = textContent.match(/(\\d+)\\s*(hour|day|week|month|year|год|дн|тиж|нед|міс|мес|рік|рок|лет|jour|sem|mois|an|dia|mes|año|tag|woch|mona|jahr)/i);
        if (match) {
            const num = parseInt(match[1], 10);
            const unit = match[2];
            
            if (/hour|год/i.test(unit)) ageDays = 0;
            else if (/day|дн|jour|dia|tag/i.test(unit)) ageDays = num;
            else if (/week|тиж|нед|sem|woch/i.test(unit)) ageDays = num * 7;
            else if (/month|міс|мес|mois|mes|mona/i.test(unit)) ageDays = num * 30;
            else if (/year|рік|рок|лет|an|año|jahr/i.test(unit)) ageDays = num * 365;
        }
        
        if (ageDays !== null && ageDays >= olderThan) {
           const url = card.querySelector('a[href*="/in/"]')?.getAttribute('href') || null;
           
           // Find the withdraw button directly in DOM
           const actionBtns = Array.from(card.querySelectorAll('button, a[role="button"], a')).filter(el => {
              if (el.querySelector('img, svg')) return false;
              if (el.getAttribute('href') && el.getAttribute('href')?.includes('/in/')) return false;
              return true;
           });
           
           let withdrawBtn = null;
           if (name) withdrawBtn = actionBtns.find(btn => (btn.getAttribute('aria-label') || '').includes(name));
           if (!withdrawBtn && actionBtns.length > 0) withdrawBtn = actionBtns[actionBtns.length - 1];
           
           if (withdrawBtn) {
              return { button: withdrawBtn, url, ageDays, name };
           }
        }
      }
      return null;
    }, olderThanDays);

    const target = await targetHandle.jsonValue() as any;
    
    if (target) {
      log(db, runId, null, "info", \`Withdrawing invitation to \${target.url} (Age: \${target.ageDays} days)\`);
      
      // Extract the element handle for the button
      const withdrawBtnHandle = await targetHandle.evaluateHandle((t: any) => t.button);
      
      if (withdrawBtnHandle) {
         await withdrawBtnHandle.scrollIntoViewIfNeeded();
         await page.waitForTimeout(Math.floor(Math.random() * 1000) + 500);
         await withdrawBtnHandle.click();
         await page.waitForTimeout(Math.floor(Math.random() * 1000) + 1000);
         
         const confirmBtn = page.locator('[role="dialog"] button.artdeco-button--primary, dialog button.artdeco-button--primary').first();
         if (await confirmBtn.count() > 0) {
            await confirmBtn.click();
            await page.waitForTimeout(Math.floor(Math.random() * 2000) + 1500);
            withdrawnCount++;
                        
            if (target.url) {
              const vanity = target.url.match(/\\/in\\/([^/?#]+)/)?.[1]?.toLowerCase();
              if (vanity) {
                 db.prepare("UPDATE targets SET degree = NULL, connected_at = NULL, connection_requested_at = NULL WHERE linkedin_url LIKE ?").run(\`%\${vanity}%\`);
              }
            }
            scrollAttempts = 0;
            await targetHandle.dispose();
            await withdrawBtnHandle.dispose();
            await page.waitForTimeout(Math.floor(Math.random() * 1000) + 1000);
            continue; 
         } else {
            console.warn(\`[withdraw] ---> ERROR: Confirm button not found in modal!\`);
            await page.keyboard.press("Escape");
         }
      }
      await withdrawBtnHandle.dispose();
    }
    await targetHandle.dispose();
    
    const cardsBefore = await page.locator('a[href*="/in/"]').count();
    
    await page.evaluate(() => {
      const workspace = document.getElementById("workspace");
      if (workspace) workspace.scrollTop = workspace.scrollHeight;
      else window.scrollTo(0, document.body.scrollHeight);
    });
    
    await page.waitForTimeout(2500);
    const cardsAfter = await page.locator('a[href*="/in/"]').count();
    
    if (cardsAfter === cardsBefore) {
      break;
    }
    
    scrollAttempts++;
  }
  
  console.log(\`[withdraw] Finished check for account=\${accountId}. Total withdrawn: \${withdrawnCount}\`);
  return withdrawnCount;
}
`;
fs.writeFileSync('lib/linkedin/withdraw.ts', code);
