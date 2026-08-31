const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

const anchor = `    emails_sent: 0,
    active_run: initial.active_run,
  };`;
const replacement = `    emails_sent: 0,
    profiles_visited: 0,
    emails_enriched: 0,
    hubspot_pushes: 0,
    active_run: initial.active_run,
  };`;
code = code.replace(anchor, replacement);

fs.writeFileSync('pages/workflows/[id].tsx', code);
