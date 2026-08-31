const fs = require("fs");
const html = fs.readFileSync("audit-withdraw-dom.html", "utf-8");
const cheerio = require("cheerio");
const $ = cheerio.load(html);

const card = $("a[aria-label*='Withdraw']").closest('li, div:has(a[href*="/in/"])');
console.log("Found card:", card.length);
card.find('button, a').each((i, el) => {
   console.log($(el).prop("tagName"), $(el).attr("aria-label"), $(el).attr("href"));
});
