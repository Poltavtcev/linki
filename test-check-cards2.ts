import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { getSessionPage } from "./lib/linkedin/session";

const ACCOUNT_ID = "2f759b56-56d3-4ca0-a10f-ec96c1cd5e2c"; 

async function run() {
  const page = await getSessionPage(ACCOUNT_ID);
  
  await page.goto("https://www.linkedin.com/mynetwork/invitation-manager/sent/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  
  const cardsInfo = await page.evaluate(() => {
      const profileLinks = Array.from(document.querySelectorAll('a[href*="/in/"]'));
      const cards = new Set();
      for (const link of profileLinks) {
         let cur = link.parentElement;
         while(cur && cur.tagName !== 'BODY') {
            const txt = cur.textContent?.toLowerCase() || "";
            const hasTime = /(\d+)\s*(hour|day|week|month|year|год|дн|тиж|нед|міс|мес|рік|рок|лет|jour|sem|mois|an|dia|mes|año|tag|woch|mona|jahr)/i.test(txt);
            const linksCount = cur.querySelectorAll('a[href*="/in/"]').length;
            
            if (hasTime && linksCount <= 3) {
               cards.add(cur);
               break;
            }
            if (linksCount > 3) break; // Went too high
            cur = cur.parentElement;
         }
      }
      return {
        cardsCount: cards.size,
        contents: Array.from(cards).map(c => (c as HTMLElement).innerText.replace(/\s+/g, ' ')).slice(0, 1)
      };
  });
  console.log("Cards Info:", cardsInfo);
  
  await page.close();
  process.exit(0);
}
run();
