const fs = require("fs");
const html = fs.readFileSync("audit-withdraw-dom.html", "utf-8");
const cheerio = require("cheerio");
const $ = cheerio.load(html);

const card = $("a[href*='/in/']").closest('div');
console.log("Card found?", card.length > 0);
card.find('a[href*="/in/"]').each((i, el) => {
   console.log("Profile link text:", $(el).text().trim().replace(/\s+/g, ' '));
   console.log("Profile link HTML:", $(el).html());
});
