const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

// 1. Add fields to Stats interface
const intfAnchor = `  inmails_sent: number;
  emails_sent: number;
  active_run: {`;
const intfReplacement = `  inmails_sent: number;
  emails_sent: number;
  profiles_visited: number;
  emails_enriched: number;
  hubspot_pushes: number;
  active_run: {`;
code = code.replace(intfAnchor, intfReplacement);

// 2. Add initial stats state
const initialAnchor = `    emails_sent: 0,
    active_run: null,
  });`;
const initialReplacement = `    emails_sent: 0,
    profiles_visited: 0,
    emails_enriched: 0,
    hubspot_pushes: 0,
    active_run: null,
  });`;
code = code.replace(initialAnchor, initialReplacement);

// 3. Add to UI
const uiAnchor = `                {displayStats.inmails_sent > 0 && (
                  <span className="text-xs text-base-content/50">
                    <span className="font-semibold text-info">{displayStats.inmails_sent}</span> inmailed
                  </span>
                )}`;
const uiReplacement = `                {displayStats.inmails_sent > 0 && (
                  <span className="text-xs text-base-content/50">
                    <span className="font-semibold text-info">{displayStats.inmails_sent}</span> inmailed
                  </span>
                )}
                {displayStats.profiles_visited > 0 && (
                  <span className="text-xs text-base-content/50">
                    <span className="font-semibold text-info">{displayStats.profiles_visited}</span> visited
                  </span>
                )}
                {displayStats.emails_enriched > 0 && (
                  <span className="text-xs text-base-content/50">
                    <span className="font-semibold text-success">{displayStats.emails_enriched}</span> enriched
                  </span>
                )}
                {displayStats.hubspot_pushes > 0 && (
                  <span className="text-xs text-base-content/50">
                    <span className="font-semibold text-success">{displayStats.hubspot_pushes}</span> to CRM
                  </span>
                )}`;
code = code.replace(uiAnchor, uiReplacement);

fs.writeFileSync('pages/workflows/[id].tsx', code);
