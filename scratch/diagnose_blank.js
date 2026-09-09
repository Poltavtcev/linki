const fs = require('fs');
const path = require('path');

const evidenceDir = path.join(process.cwd(), '.ai/evidence/linkedin');
if (!fs.existsSync(evidenceDir)) {
  console.log("No evidence directory found.");
  process.exit(0);
}

const dirs = fs.readdirSync(evidenceDir).filter(f => fs.statSync(path.join(evidenceDir, f)).isDirectory());

for (const dir of dirs) {
  console.log(`\nAnalyzing fixture: ${dir}`);
  const dirPath = path.join(evidenceDir, dir);
  
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(dirPath, 'meta.json'), 'utf8'));
    console.log(`  URL: ${meta.url}`);
    console.log(`  Title: ${meta.title}`);
    console.log(`  Error: ${meta.error}`);
    console.log(`  Action: ${meta.action}`);
  } catch (e) { console.log(`  Missing/invalid meta.json`); }
  
  try {
    const dom = fs.readFileSync(path.join(dirPath, 'dom.html'), 'utf8');
    console.log(`  DOM length: ${dom.length} characters`);
    if (dom.length < 500) {
      console.log(`  DOM snippet: ${dom.replace(/\n/g, '').substring(0, 100)}`);
    }
  } catch (e) { console.log(`  Missing dom.html`); }
  
  try {
    const interactive = JSON.parse(fs.readFileSync(path.join(dirPath, 'interactive.json'), 'utf8'));
    console.log(`  Interactive elements count: ${interactive.length}`);
  } catch (e) { console.log(`  Missing/invalid interactive.json`); }
}
