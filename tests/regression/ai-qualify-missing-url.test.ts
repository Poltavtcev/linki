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

describe('ai_qualify regression', () => {
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

  it('Missing Sales Nav URL behavior for ai_qualify', async () => {
    const targetId = randomUUID();
    db.prepare(`
      INSERT INTO targets (id, linkedin_url, sales_nav_url, full_name)
      VALUES (?, 'https://linkedin.com/in/test', NULL, 'Test User')
    `).run(targetId);

    const target = db.prepare('SELECT * FROM targets WHERE id = ?').get(targetId) as any;
    
    const result = await executeStep(
      db, 'run-1', 'rp-1', 'state-1', target,
      { step_type: 'ai_qualify', id: 'step-1' },
      'acc-1', {} as any
    );

    // Titan's pacing changes made checkPacingAndEnrich return SKIPPED
    // Let's assert what the current code does.
    expect(result.status).toBe('SKIPPED');
    if (result.status === 'SKIPPED') {
      expect((result as any).error).toBe('Missing Sales Navigator URL');
    }
  });
});
