import fs from "fs";
import iconv from "iconv-lite";

const text = `linkedin_url,first_name,last_name
https://www.linkedin.com/in/jaroslaw/,Jarosław,Chromiński`;

const buffer = iconv.encode(text, "win1250");
fs.writeFileSync("test-polish.csv", buffer);
