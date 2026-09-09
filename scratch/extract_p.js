const fs = require('fs');
const html = fs.readFileSync('.ai/evidence/linkedin/2026-09-09T15-53-57-163Z-server_login/dom.html', 'utf8');
const match = html.match(/<p[^>]*>.*?<\/p>/g);
if (match) {
  match.forEach(m => console.log(m));
}
