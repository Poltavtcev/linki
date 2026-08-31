const fs = require("fs");
const html = fs.readFileSync("audit-withdraw-dom.html", "utf-8");
const cheerio = require("cheerio");
const $ = cheerio.load(html);

// Find card
const card = $("a[href*='/in/']").closest('div');
const nameElement = card.find("span[dir='ltr'], .invitation-card__title").first();
const targetName = nameElement.text().trim();
console.log("Extracted Target Name:", targetName);

const withdrawBtn = card.find(`button[aria-label*='${targetName}'], a[aria-label*='${targetName}']`).first();
console.log("Found Withdraw button via name in aria-label?", withdrawBtn.length > 0);
if(withdrawBtn.length > 0) {
   console.log("Aria label:", withdrawBtn.attr("aria-label"));
}
