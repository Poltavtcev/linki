const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

code = code.replace(/linkedin: \[\], email: \[\] \};/, 'linkedin: [], email: [], integration: [] };');
code = code.replace(/"email-steps": "Email outreach",/, '"email-steps": "Email outreach",\n    "integration-steps": "Integration & Enrichment",');
code = code.replace(/"email-steps": <>Define automated follow-ups<\/>,/, '"email-steps": <>Define automated follow-ups</>,\n    "integration-steps": <>Define third-party API actions like enrichment</>,');

// Also update the `allOrdered` loop that handles POSTing steps to ensure the API creates them correctly!
code = code.replace(/const allOrdered = \[\.\.\.byTrack\.linkedin, \.\.\.byTrack\.email\];/, 'const allOrdered = [...byTrack.linkedin, ...byTrack.email, ...byTrack.integration];');

fs.writeFileSync('pages/workflows/[id].tsx', code);
