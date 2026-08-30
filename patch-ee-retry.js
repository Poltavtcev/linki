const fs = require('fs');
let content = fs.readFileSync('ee/index.ts', 'utf8');

content = content.replace(
  /  async classifyAndDispatch\(replyId: string\) \{/g,
  `  async retryFailed() {
    const db = getDb();
    const failed = db.prepare(\`SELECT id FROM email_replies WHERE classified_at IS NULL AND classification_error IS NOT NULL\`).all() as { id: string }[];
    for (const f of failed) {
      await this.classifyAndDispatch(f.id).catch(() => {});
    }
  },

  async classifyAndDispatch(replyId: string) {`
);

fs.writeFileSync('ee/index.ts', content);
