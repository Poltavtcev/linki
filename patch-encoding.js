const fs = require('fs');
let code = fs.readFileSync('pages/lists/[id].tsx', 'utf8');

code = code.replace(
  /const csv = await csvFile\.text\(\);/,
  `const buffer = await csvFile.arrayBuffer();
      let csv = "";
      try {
        const utf8Decoder = new TextDecoder("utf-8", { fatal: true });
        csv = utf8Decoder.decode(buffer);
      } catch (e) {
        // Fallback for Windows Excel CSVs containing Polish/Central European characters
        console.warn("CSV is not valid UTF-8, falling back to windows-1250");
        const fallbackDecoder = new TextDecoder("windows-1250");
        csv = fallbackDecoder.decode(buffer);
      }`
);

fs.writeFileSync('pages/lists/[id].tsx', code);
