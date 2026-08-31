const fs = require('fs');
let content = fs.readFileSync('lib/linkedin/runner.ts', 'utf8');

const oldTick = `export async function tickManualReplies(db: ReturnType<typeof import("@/lib/db").getDb>): Promise<void> {
  const pending = db.prepare("SELECT * FROM linkedin_reply_queue WHERE status = 'pending'").all() as Array<{ id: string, account_id: string, thread_id: string, body: string }>;
  for (const row of pending) {
    db.prepare("UPDATE linkedin_reply_queue SET status = 'processing' WHERE id = ?").run(row.id);
    try {
      const { replyToThread } = await import("./message");
      const page = await getSessionPage(row.account_id);
      try {
        await replyToThread(page, row.thread_id, row.body);`;

const newTick = `export async function tickManualReplies(db: ReturnType<typeof import("@/lib/db").getDb>): Promise<void> {
  const pending = db.prepare("SELECT q.*, t.linkedin_url FROM linkedin_reply_queue q JOIN targets t ON t.id = q.target_id WHERE q.status = 'pending'").all() as Array<{ id: string, account_id: string, thread_id: string, body: string, linkedin_url: string }>;
  for (const row of pending) {
    db.prepare("UPDATE linkedin_reply_queue SET status = 'processing' WHERE id = ?").run(row.id);
    try {
      const { replyToThread } = await import("./message");
      const page = await getSessionPage(row.account_id);
      try {
        await replyToThread(page, row.thread_id, row.body, row.linkedin_url);`;

content = content.replace(oldTick, newTick);
fs.writeFileSync('lib/linkedin/runner.ts', content);
