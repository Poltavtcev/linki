const fs = require('fs');

const buffer = fs.readFileSync('test-polish.csv');

let csv = "";
try {
  const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
  csv = utf8Decoder.decode(buffer);
  console.log("Parsed as UTF-8:", csv);
} catch (e) {
  console.log("Failed UTF-8:", e.message);
  const fallbackDecoder = new TextDecoder("windows-1250");
  csv = fallbackDecoder.decode(buffer);
  console.log("Parsed as Win1250:", csv);
}
