const fs = require('fs');
let code = fs.readFileSync('ee/index.ts', 'utf8');

const oldCode = `  const stopBasic = () => {
    if (channel === "email") {
      db.prepare("UPDATE targets SET email_replied_at = COALESCE(email_replied_at, ?) WHERE id = ?").run(now, targetId);
    } else {
      db.prepare("UPDATE targets SET last_replied_at = COALESCE(last_replied_at, ?) WHERE id = ?").run(now, targetId);
    }
  };`;

const newCode = `  const stopBasic = () => {
    if (channel === "email") {
      db.prepare("UPDATE targets SET email_replied_at = COALESCE(email_replied_at, ?) WHERE id = ?").run(now, targetId);
    } else {
      db.prepare("UPDATE targets SET last_replied_at = COALESCE(last_replied_at, ?) WHERE id = ?").run(now, targetId);
    }

    db.prepare(\`
      UPDATE run_profile_tracks 
      SET state = 'skipped', error_message = 'Lead replied'
      WHERE run_profile_id IN (SELECT id FROM run_profiles WHERE target_id = ?)
        AND state NOT IN ('completed', 'failed', 'skipped')
    \`).run(targetId);
  };`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('ee/index.ts', code);
