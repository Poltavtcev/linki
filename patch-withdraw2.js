const fs = require('fs');
let code = fs.readFileSync('lib/linkedin/withdraw.ts', 'utf8');

// Replace the card finding logic
code = code.replace(
  /for \(const link of profileLinks\) \{[\s\S]*?if \(card\) cards\.add\(card\);\n\s*\}/,
  `for (const link of profileLinks) {
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
      }`
);

// We need to also fix the locator handle for the card!
// Previously:
// const cardHandle = page.locator('a[href*="/in/"]').locator('xpath=ancestor-or-self::li | ...
// Now we use the same traversal logic in Playwright!
// Actually, since we found the `target.index`, we can just use `page.locator('a[href*="/in/"]').nth(target.index).locator('xpath=ancestor::*[contains(., "ago") or contains(., "тому") or contains(., "дн") or contains(., "day")]').last()`
// Or we can just find the button directly using evaluateHandle!
// It's MUCH better to return the `card` DOM element directly or just click the button inside the evaluate context.
// But we want to use Playwright locator for clicking to mimic human behavior (scroll, click with mouse).
