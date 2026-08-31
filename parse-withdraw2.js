const fs = require("fs");
const html = fs.readFileSync("audit-withdraw-dom.html", "utf-8");
const cheerio = require("cheerio");
const $ = cheerio.load(html);

// Find elements containing 'Withdraw' or 'Відкликати'
$("*").each((i, el) => {
  const text = $(el).text().trim();
  if (text === "Withdraw" || text === "Відкликати") {
     console.log("TAG:", el.tagName, "CLASSES:", $(el).attr("class"), "ARIA:", $(el).attr("aria-label"), "HTML:", $(el).html());
  }
});
