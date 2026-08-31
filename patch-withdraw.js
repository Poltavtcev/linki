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
    const targetToWithdraw = await page.evaluate((olderThan) => {
      // 1. Find all cards (any div or li containing an /in/ link)
      const profileLinks = Array.from(document.querySelectorAll('a[href*="/in/"]'));
      const cards = new Set();
      for (const link of profileLinks) {
         const card = link.closest('li, .invitation-card, .discovery-entity-card');
         if (card) cards.add(card);
      }
      
      const cardsArray = Array.from(cards) as Element[];
      
      for (let i = 0; i < cardsArray.length; i++) {
        const card = cardsArray[i];
        
        // Extract name
        const nameEl = card.querySelector('span[dir="ltr"], .invitation-card__title, span[aria-hidden="true"]');
        const name = nameEl ? nameEl.textContent?.trim().split(' ')[0] : '';
        
        // Extract timestamp text
        const textContent = card.textContent?.toLowerCase() || "";
        let ageDays = null;
        
        // Robust regex for numbers + timeframe units in multiple languages
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
           return { index: i, url, ageDays, name };
        }
      }
      return null;
    }, olderThanDays);

    if (targetToWithdraw) {
      const target = targetToWithdraw;
      log(db, runId, null, "info", \`Withdrawing invitation to \${target.url} (Age: \${target.ageDays} days)\`);
      
      // Select the exact card we matched
      const cardHandle = page.locator('a[href*="/in/"]').locator('xpath=ancestor-or-self::li | ancestor-or-self::*[contains(@class, "invitation-card")] | ancestor-or-self::*[contains(@class, "discovery-entity-card")]').nth(target.index);
      
      // Find the actionable buttons inside the card
      const actionBtns = cardHandle.locator('button, a[role="button"], a').filter({
        hasNot: page.locator('img, svg, a[href*="/in/"]')
      });
      
      // Language-agnostic withdraw selection: The button whose aria-label contains the target's name
      let withdrawBtn = actionBtns.filter({ has: page.locator(\`[aria-label*="\${target.name}"]\`) }).first();
      
      // Fallback: the last actionable button
      if (await withdrawBtn.count() === 0) {
        withdrawBtn = actionBtns.last();
      }
      
      if (await withdrawBtn.count() > 0) {
         await withdrawBtn.scrollIntoViewIfNeeded();
         await page.waitForTimeout(Math.floor(Math.random() * 1000) + 500);
         await withdrawBtn.click();
         await page.waitForTimeout(Math.floor(Math.random() * 1000) + 1000);
         
         // The modal confirmation button is ALWAYS the primary artdeco button in the dialog
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
            await page.waitForTimeout(Math.floor(Math.random() * 1000) + 1000);
            continue; 
         } else {
            console.warn(\`[withdraw] ---> ERROR: Confirm button not found in modal!\`);
            await page.keyboard.press("Escape");
         }
      } else {
         console.warn(\`[withdraw] ---> ERROR: Withdraw button not found on page despite DOM match!\`);
      }
    }
    
    // Scroll state tracking
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
