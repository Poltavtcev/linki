const fs = require('fs');
const content = fs.readFileSync('/Users/admin/Downloads/linki-import-template-2.csv');
console.log("File size:", content.length);
console.log("Does it contain literal 'Jaros?aw' (3F)?", content.includes(Buffer.from("Jaros?aw")));
console.log("Does it contain UTF-8 'Jarosław' (C5 82)?", content.includes(Buffer.from("Jarosław")));
