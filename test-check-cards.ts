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
         const card = link.closest('li, .invitation-card, .discovery-entity-card');
         if (card) cards.add(card);
      }
      return {
        linksCount: profileLinks.length,
        cardsCount: cards.size,
        classes: profileLinks.map(l => l.className),
        links: profileLinks.map(l => l.getAttribute('href')),
        parentTags: profileLinks.map(l => l.parentElement?.tagName)
      };
  });
  console.log("Cards Info:", cardsInfo);
  
  await page.close();
  process.exit(0);
}
run();
