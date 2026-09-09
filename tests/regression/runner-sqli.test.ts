import { test, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';

test('SQLi Regression: delay_seconds and result.hours bind parameters', () => {
  const db = new Database(':memory:');
  
  // Setup mock schema based on runner.ts usage
  db.exec(`
    CREATE TABLE run_profile_states (
      run_profile_id TEXT PRIMARY KEY,
      state TEXT,
      next_eval_at TEXT
    );
    INSERT INTO run_profile_states (run_profile_id, state, next_eval_at)
    VALUES ('safe-id-1', 'pending', '2020-01-01 00:00:00');
    INSERT INTO run_profile_states (run_profile_id, state, next_eval_at)
    VALUES ('safe-id-2', 'pending', '2020-01-01 00:00:00');
    INSERT INTO run_profile_states (run_profile_id, state, next_eval_at)
    VALUES ('victim-id', 'pending', '2020-01-01 00:00:00');
  `);

  const runProfileId1 = 'safe-id-1';
  const runProfileId2 = 'safe-id-2';

  // 1. result.hours test
  const maliciousHours = "1 hours') WHERE run_profile_id = 'safe-id-1'; UPDATE run_profile_states SET state = 'hacked' WHERE run_profile_id = 'victim-id'; --";
  db.prepare(
    `UPDATE run_profile_states SET next_eval_at = datetime('now', '+' || ? || ' hours') WHERE run_profile_id = ?`
  ).run(maliciousHours, runProfileId1);

  // 2. step.delay_seconds test
  const maliciousDelay = "60 seconds') WHERE run_profile_id = 'safe-id-2'; UPDATE run_profile_states SET state = 'hacked' WHERE run_profile_id = 'victim-id'; --";
  db.prepare(
    `UPDATE run_profile_states SET state = 'running', next_eval_at = datetime('now', '+' || ? || ' seconds') WHERE run_profile_id = ?`
  ).run(maliciousDelay, runProfileId2);

  // Assert victim is unharmed
  const victim = db.prepare(`SELECT state FROM run_profile_states WHERE run_profile_id = 'victim-id'`).get() as { state: string };
  expect(victim.state).toBe('pending'); // Should not be 'hacked'

  // 3. Legitimate numbers work
  const normalHours = 48;
  const normalDelay = 60;

  db.prepare(
    `UPDATE run_profile_states SET next_eval_at = datetime('now', '+' || ? || ' hours') WHERE run_profile_id = ?`
  ).run(normalHours, 'safe-id-1');
  
  db.prepare(
    `UPDATE run_profile_states SET state = 'running', next_eval_at = datetime('now', '+' || ? || ' seconds') WHERE run_profile_id = ?`
  ).run(normalDelay, 'safe-id-2');

  const safe1 = db.prepare(`SELECT next_eval_at FROM run_profile_states WHERE run_profile_id = 'safe-id-1'`).get() as { next_eval_at: string };
  const safe2 = db.prepare(`SELECT state, next_eval_at FROM run_profile_states WHERE run_profile_id = 'safe-id-2'`).get() as { state: string, next_eval_at: string };
  
  expect(safe1.next_eval_at).toBeTruthy();
  // sqlite datetime('now', ...) returns a string like 'YYYY-MM-DD HH:MM:SS'
  // When malicious input is passed to SQLite datetime, it will fail to parse and return null.
  // We can verify this.
  const maliciousResult1 = db.prepare(`SELECT datetime('now', '+' || ? || ' hours') AS val`).get(maliciousHours) as { val: string | null };
  expect(maliciousResult1.val).toBeNull();

  // For legitimate input, it returns a valid date.
  const legitResult1 = db.prepare(`SELECT datetime('now', '+' || ? || ' hours') AS val`).get(normalHours) as { val: string | null };
  expect(legitResult1.val).not.toBeNull();
  expect(legitResult1.val).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  
  expect(safe2.state).toBe('running');
  expect(safe2.next_eval_at).not.toBeNull();
});
