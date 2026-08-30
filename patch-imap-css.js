const fs = require('fs');
let content = fs.readFileSync('lib/email/inbox.ts', 'utf8');

// Add cheerio import
content = 'import * as cheerio from "cheerio";\n' + content;

// Replace HTML parsing
content = content.replace(
  /          const rawText =\n            parsed\.text \?\?\n            \(parsed\.html \? parsed\.html\.replace\(\/<\[\^>\]\+>\/g, " "\) : ""\);/g,
  `          let rawText = parsed.text ?? "";
          if (!rawText && parsed.html) {
            const $ = cheerio.load(parsed.html);
            // Remove CSS, scripts, and common quote blocks to prevent AI hallucination
            $("style, script, head, title, meta, blockquote, .gmail_quote, .yahoo_quoted, [id*='quote']").remove();
            rawText = $.text() || "";
          } else if (rawText) {
            // Even if plain text is present, we should attempt to strip quotes if possible
            // A simple heuristic for plain text quotes is splitting by "> " or "On ... wrote:"
            rawText = rawText.split(/^On .* wrote:$/m)[0] || rawText;
            rawText = rawText.split(/\\n> /)[0] || rawText;
          }`
);

fs.writeFileSync('lib/email/inbox.ts', content);
