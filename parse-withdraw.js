const fs = require("fs");
const html = fs.readFileSync("audit-withdraw-dom.html", "utf-8");
const cheerio = require("cheerio");
const $ = cheerio.load(html);
$("button").each((i, el) => {
  console.log($(el).text().trim(), $(el).attr("aria-label") || "no-aria", $(el).attr("class"));
});
