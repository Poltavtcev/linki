const fs = require("fs");
const html = fs.readFileSync("audit-profile-dom.html", "utf-8");
const cheerio = require("cheerio");
const $ = cheerio.load(html);

console.log("Looking for actionable buttons in profile main area...");
$("main button, main a").each((i, el) => {
   const text = $(el).text().trim().replace(/\s+/g, ' ');
   if (text.length > 0 && text.length < 30) {
      console.log($(el).prop("tagName"), $(el).attr("aria-label"), text);
   }
});
