const fs = require('fs');
let content = fs.readFileSync('lib/email/inbox.ts', 'utf8');

content = content.replace(
  /    fetch\.on\("message", \(msg\) => \{\n      msg\.on\("body", \(stream\) => \{\n        stream\.on\("data", \(c: Buffer\) => chunks\.push\(c\)\);\n      \}\);\n    \}\);/g,
  `    let totalSize = 0;
    fetch.on("message", (msg) => {
      msg.on("body", (stream) => {
        stream.on("data", (c: Buffer) => {
          if (totalSize < 1024 * 1024 * 2) { // Cap at 2MB to prevent OOM on giant attachments
            chunks.push(c);
            totalSize += c.length;
          }
        });
      });
    });`
);

fs.writeFileSync('lib/email/inbox.ts', content);
