import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { getSessionPage } from "./lib/linkedin/session";

const ACCOUNT_ID = "2f759b56-56d3-4ca0-a10f-ec96c1cd5e2c"; 

async function run() {
  const page = await getSessionPage(ACCOUNT_ID);
  
  await page.goto("https://www.linkedin.com/mynetwork/invitation-manager/sent/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  
  const olderThanDays = 0;
  
  const targetToWithdraw = await page.evaluate((olderThan) => {
      const profileLinks = Array.from(document.querySelectorAll('a[href*="/in/"]'));
      const cards = new Set();
      for (const link of profileLinks) {
         const card = link.closest('li, .invitation-card, .discovery-entity-card');
         if (card) cards.add(card);
      }
      
      const cardsArray = Array.from(cards) as Element[];
      
      for (let i = 0; i < cardsArray.length; i++) {
        const card = cardsArray[i];
        const nameEl = card.querySelector('span[dir="ltr"], .invitation-card__title, span[aria-hidden="true"]');
        const name = nameEl ? nameEl.textContent?.trim().split(' ')[0] : '';
        const textContent = card.textContent?.toLowerCase() || "";
        
        let ageDays = null;
        const match = textContent.match(/(\d+)\s*(hour|day|week|month|year|год|дн|тиж|нед|міс|мес|рік|рок|лет|jour|sem|mois|an|dia|mes|año|tag|woch|mona|jahr)/i);
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
  
  console.log("Found target to withdraw:", targetToWithdraw);
  
  if (targetToWithdraw) {
      const cardHandle = page.locator('a[href*="/in/"]').locator('xpath=ancestor-or-self::li | ancestor-or-self::*[contains(@class, "invitation-card")] | ancestor-or-self::*[contains(@class, "discovery-entity-card")]').nth(targetToWithdraw.index);
      
      const actionBtns = cardHandle.locator('button, a[role="button"], a').filter({
        hasNot: page.locator('img, svg, a[href*="/in/"]')
      });
      
      let withdrawBtn = actionBtns.filter({ has: page.locator(`[aria-label*="${targetToWithdraw.name}"]`) }).first();
      
      if (await withdrawBtn.count() === 0) {
        withdrawBtn = actionBtns.last();
      }
      
      if (await withdrawBtn.count() > 0) {
         console.log("Successfully found withdraw button! Text:", await withdrawBtn.textContent());
         // We won't actually click it so we don't withdraw Ewa for real, just verify the selector!
      } else {
         console.log("Failed to find withdraw button via Locator");
      }
  }
  
  await page.close();
  process.exit(0);
}
// Remove getDb import from session.ts temporarily for testing
