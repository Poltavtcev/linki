const { getDb } = require('../lib/db');
const db = getDb();

// 1. Check recent email_replies
const replies = db.prepare(`
  SELECT id, target_id, from_email, subject, ai_classification, ai_classification_reason, created_at 
  FROM email_replies 
  ORDER BY created_at DESC LIMIT 5
`).all();

console.log("=== RECENT REPLIES ===");
console.table(replies);

// 2. Check targets for those replies
if (replies.length > 0) {
  const targetIds = replies.map(r => "'" + r.target_id + "'").join(',');
  const targets = db.prepare(`
    SELECT t.id, t.email, t.email_replied_at, rt.track, rt.state, rt.current_step
    FROM targets t
    JOIN run_profiles rp ON rp.target_id = t.id
    JOIN run_profile_tracks rt ON rt.run_profile_id = rp.id
    WHERE t.id IN (${targetIds})
  `).all();
  console.log("=== TARGET STATES FOR THOSE REPLIES ===");
  console.table(targets);
}

// 3. Check stuck 'pending' or 'in_progress' targets that HAVE a reply
const stuckTargets = db.prepare(`
  SELECT t.id, t.email, t.email_replied_at, rt.state, rt.track, COUNT(er.id) as reply_count
  FROM targets t
  JOIN run_profiles rp ON rp.target_id = t.id
  JOIN run_profile_tracks rt ON rt.run_profile_id = rp.id
  JOIN email_replies er ON er.target_id = t.id
  WHERE rt.state IN ('pending', 'in_progress')
  GROUP BY t.id
  LIMIT 5
`).all();

console.log("=== STUCK TARGETS WITH REPLIES ===");
console.table(stuckTargets);
