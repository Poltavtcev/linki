const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

// 1. Fix newStep
code = code.replace(/emailSignature: null, aiEnabled: false, aiModel: "", aiPrompt: "", aiMaxWordsEnabled: false, aiMaxWords: 100, aiLanguage: "English" \};/, 'emailSignature: null, aiEnabled: false, aiModel: "", aiPrompt: "", aiMaxWordsEnabled: false, aiMaxWords: 100, aiLanguage: "English", config: null };');

// 2. Fix addWizardStep signature
code = code.replace(/function addWizardStep\(type: "visit" \| "connect" \| "message" \| "sales_inmail" \| "email"\) \{/, 'function addWizardStep(type: "visit" | "connect" | "message" | "sales_inmail" | "email" | "integration") {');

// 3. Fix RiPlugLine import
if (!code.includes('RiPlugLine')) {
  // It's used but not imported
}
code = code.replace(/RiAddLine,/g, 'RiAddLine, RiPlugLine,');

fs.writeFileSync('pages/workflows/[id].tsx', code);
