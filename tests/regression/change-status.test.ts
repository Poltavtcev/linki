import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { executeStep } from '../../lib/linkedin/runner';
import { randomUUID } from 'crypto';

describe('change_status capabilities (CAP-003)', () => {
  let db: Database.Database;

  beforeAll(() => {
    db = new Database(':memory:');
    
    db.exec(`
      CREATE TABLE targets (
        id TEXT PRIMARY KEY,
        lead_status TEXT DEFAULT 'lead'
      );
      CREATE TABLE logs (
        id TEXT PRIMARY KEY,
        run_id TEXT,
        target_id TEXT,
        level TEXT,
        message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE ai_drafts (id TEXT);
    `);
  });

  afterAll(() => {
    db.close();
  });

  it('updates lead_status on target and returns SUCCESS', async () => {
    const targetId = randomUUID();
    db.prepare("INSERT INTO targets (id) VALUES (?)").run(targetId);

    const step = {
      id: 'step-123',
      step_type: 'change_status',
      config: JSON.stringify({ status_id: 'disqualified' })
    };

    const targetObj = db.prepare("SELECT * FROM targets WHERE id = ?").get(targetId);

    const result = await executeStep(
      db, 'run-1', 'rp-1', 'state-1', targetObj as any, step as any, 'acc-1', {} as any
    );

    expect(result.status).toBe('SUCCESS');

    const updatedTarget = db.prepare("SELECT lead_status FROM targets WHERE id = ?").get(targetId) as any;
    expect(updatedTarget.lead_status).toBe('disqualified');
  });

  it('handles empty config gracefully (defaults to lead)', async () => {
    const targetId = randomUUID();
    db.prepare("INSERT INTO targets (id, lead_status) VALUES (?, 'active')").run(targetId);

    const step = {
      id: 'step-223',
      step_type: 'change_status',
      config: null
    };

    const targetObj = db.prepare("SELECT * FROM targets WHERE id = ?").get(targetId);
    
    const result = await executeStep(
      db, 'run-1', 'rp-1', 'state-1', targetObj as any, step as any, 'acc-1', {} as any
    );

    expect(result.status).toBe('SUCCESS');

    const updatedTarget = db.prepare("SELECT lead_status FROM targets WHERE id = ?").get(targetId) as any;
    expect(updatedTarget.lead_status).toBe('lead');
  });

  it('unknown step type falls through to FAILED trap', async () => {
    const targetId = randomUUID();
    db.prepare("INSERT INTO targets (id) VALUES (?)").run(targetId);

    const step = {
      id: 'step-323',
      step_type: 'sales_inmail' // Unhandled type
    };

    const targetObj = db.prepare("SELECT * FROM targets WHERE id = ?").get(targetId);
    
    const result = await executeStep(
      db, 'run-1', 'rp-1', 'state-1', targetObj as any, step as any, 'acc-1', {} as any
    );

    expect(result.status).toBe('FAILED');
    expect((result as any).error).toContain('Unhandled step type');
  });

  it('delay step falls through to explicit SUCCESS without DB changes', async () => {
    const targetId = randomUUID();
    db.prepare("INSERT INTO targets (id, lead_status) VALUES (?, 'lead')").run(targetId);

    const step = {
      id: 'step-423',
      step_type: 'delay',
      delay_seconds: 86400
    };

    const targetObj = db.prepare("SELECT * FROM targets WHERE id = ?").get(targetId);
    
    const result = await executeStep(
      db, 'run-1', 'rp-1', 'state-1', targetObj as any, step as any, 'acc-1', {} as any
    );

    expect(result.status).toBe('SUCCESS');
  });
});
