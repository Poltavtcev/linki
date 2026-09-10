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

describe('business-skip linkedin_enrich regression', () => {
  let db: ReturnType<typeof getDb>;
  
  beforeEach(() => {
    db = getDb();
    db.prepare('DELETE FROM logs').run();
    db.prepare('DELETE FROM targets').run();
    db.prepare('DELETE FROM account_pacing_state').run();
    db.prepare('DELETE FROM runs').run();
    db.prepare(`INSERT INTO runs (id) VALUES ('run-1')`).run();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('Case A: no Sales Nav URL -> SKIPPED and logs previous message', async () => {
    const targetId = randomUUID();
    db.prepare(`
      INSERT INTO targets (id, linkedin_url, sales_nav_url, full_name)
      VALUES (?, 'https://linkedin.com/in/test', NULL, 'Test User')
    `).run(targetId);

    const target = db.prepare('SELECT * FROM targets WHERE id = ?').get(targetId) as any;
    
    const result = await executeStep(
      db, 'run-1', 'rp-1', 'state-1', target,
      { step_type: 'linkedin_enrich', id: 'step-1' },
      'acc-1', {} as any
    );

    expect(result.status).toBe('SKIPPED');
    if (result.status === 'SKIPPED') {
      expect((result as any).error).toBe('Missing Sales Navigator URL');
    }

    const logs = db.prepare('SELECT * FROM logs WHERE target_id = ?').all(targetId) as any[];
    const logMessages = logs.map(l => l.message);
    const logLevels = logs.map(l => l.level);
    
    expect(logMessages).not.toContain('Enriching profile for Test User');
    expect(logMessages).toContain('Missing Sales Navigator URL for Test User');
    expect(logLevels[logMessages.indexOf('Missing Sales Navigator URL for Test User')]).toBe('error');
  });

  it('Case B: valid URL -> paced -> WAIT_UNTIL and no phantom log', async () => {
    const targetId = randomUUID();
    db.prepare(`
      INSERT INTO targets (id, linkedin_url, sales_nav_url, full_name)
      VALUES (?, 'https://linkedin.com/in/test', 'https://linkedin.com/sales/lead/test', 'Test User')
    `).run(targetId);

    db.prepare(`
      INSERT INTO account_pacing_state (account_id, action_type, last_executed_at)
      VALUES (?, 'linkedin_enrich', ?)
    `).run('acc-1', new Date().toISOString());

    const target = db.prepare('SELECT * FROM targets WHERE id = ?').get(targetId) as any;
    
    const result = await executeStep(
      db, 'run-1', 'rp-1', 'state-1', target,
      { step_type: 'linkedin_enrich', id: 'step-1' },
      'acc-1', {} as any
    );

    expect(result.status).toBe('WAIT_UNTIL');

    const logs = db.prepare('SELECT * FROM logs WHERE target_id = ?').all(targetId) as any[];
    const logMessages = logs.map(l => l.message);
    expect(logMessages).not.toContain('Enriching profile for Test User');
  });

  it('Case C: actual execution crash -> FAILED', async () => {
    const { enrichProfile } = await import('@/lib/linkedin/enrich');
    vi.mocked(enrichProfile).mockRejectedValueOnce(new Error('Crash'));

    const targetId = randomUUID();
    db.prepare(`
      INSERT INTO targets (id, linkedin_url, sales_nav_url, full_name)
      VALUES (?, 'https://linkedin.com/in/test', 'https://linkedin.com/sales/lead/test', 'Test User')
    `).run(targetId);

    const target = db.prepare('SELECT * FROM targets WHERE id = ?').get(targetId) as any;
    
    const result = await executeStep(
      db, 'run-1', 'rp-1', 'state-1', target,
      { step_type: 'linkedin_enrich', id: 'step-1' },
      'acc-1', {} as any
    );

    expect(result.status).toBe('FAILED');
    if (result.status === 'FAILED') {
      expect(result.error).toBe('ENRICHMENT_FAILED');
    }

    const logs = db.prepare('SELECT * FROM logs WHERE target_id = ?').all(targetId) as any[];
    const logMessages = logs.map(l => l.message);
    expect(logMessages).toContain('Enriching profile for Test User'); // Before it crashed, it logged enriching
  });

  it('Case D: already enriched -> SUCCESS path', async () => {
    const targetId = randomUUID();
    db.prepare(`
      INSERT INTO targets (id, linkedin_url, sales_nav_url, enriched_profile_at, full_name)
      VALUES (?, 'https://linkedin.com/in/test', 'https://linkedin.com/sales/lead/test', ?, 'Test User')
    `).run(targetId, new Date().toISOString());

    const target = db.prepare('SELECT * FROM targets WHERE id = ?').get(targetId) as any;
    
    const result = await executeStep(
      db, 'run-1', 'rp-1', 'state-1', target,
      { step_type: 'linkedin_enrich', id: 'step-1' },
      'acc-1', {} as any
    );

    expect(result.status).toBe('SUCCESS');

    const logs = db.prepare('SELECT * FROM logs WHERE target_id = ?').all(targetId) as any[];
    const logMessages = logs.map(l => l.message);
    expect(logMessages).not.toContain('Enriching profile for Test User');
    expect(logMessages).toContain('Test User is already enriched — skipping scrape');
  });
});
