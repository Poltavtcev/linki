import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

describe('Message Accounting Projection Contract', () => {
  let db: Database.Database;
  const mockRunId = randomUUID();
  const mockTargetId = randomUUID();

  beforeAll(() => {
    db = new Database(':memory:');
    
    // Minimal schema for projection accounting
    db.exec(`
      CREATE TABLE logs (
        id TEXT PRIMARY KEY,
        run_id TEXT,
        target_id TEXT,
        level TEXT,
        message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  afterAll(() => {
    db.close();
  });

  it('Funnel strictly counts LI Messages via "Message sent" logs (QA Accounting Contract)', () => {
    // 1. Insert logs typical of a message step execution
    db.prepare("INSERT INTO logs (id, run_id, target_id, level, message) VALUES (?, ?, ?, ?, ?)").run(
      randomUUID(), mockRunId, mockTargetId, "info", "Messaging Maria Solodar"
    );
    
    // Simulate the fix: explicitly inserting the "Message sent to" log
    db.prepare("INSERT INTO logs (id, run_id, target_id, level, message) VALUES (?, ?, ?, ?, ?)").run(
      randomUUID(), mockRunId, mockTargetId, "info", "Message sent to Maria Solodar"
    );

    // Simulate an idempotency log on retry
    db.prepare("INSERT INTO logs (id, run_id, target_id, level, message) VALUES (?, ?, ?, ?, ?)").run(
      randomUUID(), mockRunId, mockTargetId, "info", "Idempotency: message already sent for step XYZ, skipping network call"
    );

    // 2. Execute the exact projection query used in analytics.ts/stats.ts
    // WHERE run_id IN (${RUNS}) AND message LIKE 'Message sent%'
    const result = db.prepare(`
      SELECT COUNT(*) as messages_sent 
      FROM logs 
      WHERE run_id = ? AND message LIKE 'Message sent%'
    `).get(mockRunId) as { messages_sent: number };

    // 3. Verify exactly 1 message counted (idempotency log & messaging start are ignored)
    expect(result.messages_sent).toBe(1);
  });
});
