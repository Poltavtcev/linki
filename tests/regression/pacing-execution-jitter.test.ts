import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeStep } from '@/lib/linkedin/runner';
import { getDb } from '@/lib/db';
import { randomUUID } from 'crypto';

vi.mock('@/lib/linkedin/session', () => ({
  getSessionPage: vi.fn(),
  saveSessionState: vi.fn(),
  getSessionContext: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/linkedin/enrich', () => ({
  enrichProfile: vi.fn().mockResolvedValue(true),
}));

describe('execution-based account pacing with jitter', () => {
  let db: ReturnType<typeof getDb>;
  let sharedAccountId = randomUUID();
  let workflowId = randomUUID();
  
  beforeEach(() => {
    db = getDb();
    db.prepare('PRAGMA foreign_keys = OFF;').run();
    db.prepare('DELETE FROM logs').run();
    db.prepare('DELETE FROM targets').run();
    db.prepare('DELETE FROM account_pacing_state').run();
    db.prepare('DELETE FROM runs').run();
    db.prepare('DELETE FROM accounts').run();
    db.prepare('DELETE FROM workflows').run();
    
    // Insert account
    db.prepare(`INSERT INTO accounts (id, name, email) VALUES (?, 'Shared', 'shared@test.com')`).run(sharedAccountId);
    db.prepare(`INSERT INTO workflows (id, name) VALUES (?, 'Test WF')`).run(workflowId);
    
    // Create two campaigns (runs)
    db.prepare(`INSERT INTO runs (id, account_id, workflow_id) VALUES ('run-A', ?, ?)`).run(sharedAccountId, workflowId);
    db.prepare(`INSERT INTO runs (id, account_id, workflow_id) VALUES ('run-B', ?, ?)`).run(sharedAccountId, workflowId);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('allows first enrichment, then blocks the second one across campaigns with >= 5min gap', async () => {
    const targetA = randomUUID();
    const targetB = randomUUID();
    
    db.prepare(`
      INSERT INTO targets (id, linkedin_url, sales_nav_url, full_name)
      VALUES (?, 'https://linkedin.com/in/testA', 'https://linkedin.com/sales/lead/testA', 'Test A')
    `).run(targetA);
    
    db.prepare(`
      INSERT INTO targets (id, linkedin_url, sales_nav_url, full_name)
      VALUES (?, 'https://linkedin.com/in/testB', 'https://linkedin.com/sales/lead/testB', 'Test B')
    `).run(targetB);

    const tA = db.prepare('SELECT * FROM targets WHERE id = ?').get(targetA) as any;
    const tB = db.prepare('SELECT * FROM targets WHERE id = ?').get(targetB) as any;

    const startMs = Date.now();
    
    // Simulate Campaign A evaluating its target first
    const resultA = await executeStep(
      db, 'run-A', 'rp-A', 'state-A', tA,
      { step_type: 'linkedin_enrich', id: 'step-A' },
      sharedAccountId, {} as any
    );
    
    expect(resultA.status).toBe('SUCCESS'); // Enrichment runs
    
    // Simulate Campaign B evaluating its target immediately after
    const resultB = await executeStep(
      db, 'run-B', 'rp-B', 'state-B', tB,
      { step_type: 'linkedin_enrich', id: 'step-B' },
      sharedAccountId, {} as any
    );
    
    expect(resultB.status).toBe('WAIT_UNTIL'); // Enrichment blocks
    
    if (resultB.status === 'WAIT_UNTIL') {
      const waitTimeMs = new Date(resultB.next_eval_at).getTime();
      const minWaitTimeMs = startMs + 300000; // Hard minimum of 5 minutes from start
      // It should be at least minGap (5m) into the future
      expect(waitTimeMs).toBeGreaterThanOrEqual(minWaitTimeMs - 100); // 100ms tolerance
    }
  });

  it('deletion of Campaign A does not block Campaign B if no enrichment occurred', async () => {
    const targetB = randomUUID();
    db.prepare(`
      INSERT INTO targets (id, linkedin_url, sales_nav_url, full_name)
      VALUES (?, 'https://linkedin.com/in/testB', 'https://linkedin.com/sales/lead/testB', 'Test B')
    `).run(targetB);

    const tB = db.prepare('SELECT * FROM targets WHERE id = ?').get(targetB) as any;
    
    const tenMinutesAgo = new Date(Date.now() - 600000).toISOString();
    
    db.prepare(`
      INSERT INTO account_pacing_state (account_id, action_type, last_executed_at)
      VALUES (?, 'linkedin_enrich', ?)
    `).run(sharedAccountId, tenMinutesAgo);
    
    // Campaign B target evaluates
    const resultB = await executeStep(
      db, 'run-B', 'rp-B', 'state-B', tB,
      { step_type: 'linkedin_enrich', id: 'step-B' },
      sharedAccountId, {} as any
    );
    
    // Should run immediately because 5 minutes have passed since last actual execution!
    expect(resultB.status).toBe('SUCCESS');
  });
});
