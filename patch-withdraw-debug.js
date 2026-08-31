const fs = require('fs');
let content = fs.readFileSync('lib/linkedin/withdraw.ts', 'utf8');
content = content.replace(
  /if \(ageDays !== null && ageDays >= olderThan\) {/g,
  `console.log("Card " + i + ": URL=" + url + " NAME=" + name + " AGE=" + ageDays + " TEXT=" + textContent.substring(0,40));\n        if (ageDays !== null && ageDays >= olderThan) {`
);
fs.writeFileSync('lib/linkedin/withdraw.ts', content);
