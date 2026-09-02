const fs = require('fs');
let code = fs.readFileSync('pages/contacts/[id].tsx', 'utf8');
code = code.replace(/RiDeleteBinLine, RiCalendarLine,/, "RiDeleteBinLine, RiCalendarLine, RiFileCopyLine,");
fs.writeFileSync('pages/contacts/[id].tsx', code);
