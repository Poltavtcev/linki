const fs = require('fs');
let code = fs.readFileSync('lib/db.ts', 'utf8');

// Insert the unique index creation
code = code.replace(
  /ALTER TABLE email_replies_new RENAME TO email_replies;/,
  `ALTER TABLE email_replies_new RENAME TO email_replies;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_email_replies_target_msg ON email_replies(target_id, message_id) WHERE message_id IS NOT NULL;`
);

fs.writeFileSync('lib/db.ts', code);
