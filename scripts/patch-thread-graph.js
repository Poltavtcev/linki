const fs = require('fs');
let code = fs.readFileSync('pages/api/inbox/thread.ts', 'utf8');

// Ensure EmailMessage has inReplyTo and references
code = code.replace(
  /messageId: string \| null;\n\}/,
  `messageId: string | null;
  inReplyTo: string | null;
  references: string[];
}`
);

// Capture inReplyTo and references
code = code.replace(
  /messageId: parsed\.messageId \?\? null,\n\s*\}\);/,
  `messageId: parsed.messageId ?? null,
                      inReplyTo: parsed.inReplyTo ?? null,
                      references: typeof parsed.references === 'string' ? parsed.references.split(/\\s+/) : (parsed.references || []),
                    });`
);

// Graph logic
code = code.replace(
  /if \(knownMessageIds\.has\(mId\)\) \{\s*connected\.add\(mId\);\s*linked = true;\s*changed = true;\s*\}/,
  `
                  // Check if it links to a known message
                  const refs = [m.inReplyTo, ...(m.references || [])].filter(Boolean).map(r => r.replace(/^<|>$/g, ''));
                  if (knownMessageIds.has(mId) || refs.some(r => connected.has(r))) {
                    connected.add(mId);
                    linked = true;
                    changed = true;
                  }
  `
);

fs.writeFileSync('pages/api/inbox/thread.ts', code);
