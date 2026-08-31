const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

const anchor = `const newStep: WizardStep = { track, type, delayDaysBefore: isFirstInTrack ? 0 : 1, connectNote: "", messageBody: "", templateId: null, templateIds: [], emailSubject: "", emailBody: "", emailSignature: null, aiEnabled: false, aiModel: "", aiPrompt: "", aiMaxWordsEnabled: false, aiMaxWords: 100, aiLanguage: "English", config: null };`;

const replacement = `const newStep: WizardStep = { track, type, delayDaysBefore: isFirstInTrack ? 0 : 1, connectNote: "", messageBody: "", templateId: null, templateIds: [], emailSubject: "", emailBody: "", emailSignature: null, aiEnabled: false, aiModel: "", aiPrompt: "", aiMaxWordsEnabled: false, aiMaxWords: 100, aiLanguage: "English", config: type === "integration" ? JSON.stringify({ action_type: "enrich_email", provider_chain: ["prospeo", "apollo", "snov", "skrapp", "hunter", "lusha", "contactout"] }) : null };`;

code = code.replace(anchor, replacement);
fs.writeFileSync('pages/workflows/[id].tsx', code);
