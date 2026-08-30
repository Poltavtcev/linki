const { getDb } = require('../lib/db');
const db = getDb();

try {
  db.exec(`ALTER TABLE email_accounts ADD COLUMN inbox_last_uid INTEGER`);
} catch (e) {
  // Ignore if already exists
}

try {
  db.exec(`ALTER TABLE email_accounts ADD COLUMN inbox_uidvalidity INTEGER`);
} catch (e) {
  // Ignore if already exists
}

try {
  db.exec(`ALTER TABLE run_profile_tracks ADD COLUMN last_email_message_id TEXT`);
} catch (e) {
  // Ignore if already exists
}

console.log("Migration complete.");
