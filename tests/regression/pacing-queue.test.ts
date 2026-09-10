import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "../../lib/db";
import { randomUUID } from "crypto";

const db = getDb();

function insertAccount(id: string) {
  db.prepare("INSERT OR IGNORE INTO accounts (id, name, email) VALUES (?, 'T', ?)").run(id, id + "@t.com");
}

function insertTarget(id: string) {
  db.prepare("INSERT INTO targets (id, sales_nav_url, full_name) VALUES (?, 'http://sn', 'T')").run(id);
}

function insertRun(runId: string, accountId: string) {
  const wId = randomUUID();
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'W')").run(wId);
  db.prepare("INSERT INTO runs (id, workflow_id, account_id, status) VALUES (?, ?, ?, 'running')").run(runId, wId, accountId);
}

describe("Persistent Pacing Queue", () => {
  let accountId: string;
  
  beforeEach(() => {
    accountId = randomUUID();
    insertAccount(accountId);
  });
  
  it("THROTTLED/cooldown -> WAIT_UNTIL, never FAILED", async () => {
    const target1 = randomUUID();
    insertTarget(target1);
    
    // Simulate first run - pessimistically reserves execution
    db.prepare(`
      INSERT INTO account_pacing_state (account_id, action_type, last_executed_at)
      VALUES (?, 'linkedin_enrich', ?)
    `).run(accountId, new Date().toISOString());
    
    // Evaluate target 1 (now - last < 300s) -> should return WAIT_UNTIL, not FAILED
    const runnerPath = "../../lib/linkedin/runner";
    const runner = await import(runnerPath);
    // Since checkPacingAndEnrich is not exported, we can call executeStep directly
    const runId = randomUUID();
    insertRun(runId, accountId);
    
    const rpId = randomUUID();
    db.prepare("INSERT INTO run_profiles (id, run_id, target_id) VALUES (?, ?, ?)").run(rpId, runId, target1);
    
    const stateId = randomUUID();
    const step = { id: randomUUID(), step_type: 'linkedin_enrich' };
    
    const targetRow = db.prepare("SELECT * FROM targets WHERE id=?").get(target1);
    const result = await runner.executeStep(db, runId, rpId, stateId, targetRow, step, accountId, {}, null, null, null, () => {});
    
    expect(result.status).toBe("WAIT_UNTIL");
    expect(result.next_eval_at).toBeDefined();
    
    // Also check it updated last_reserved_at
    const pacing = db.prepare("SELECT * FROM account_pacing_state WHERE account_id=? AND action_type='linkedin_enrich'").get(accountId) as any;
    expect(pacing.last_reserved_at).toBeTruthy();
  });

  it("reserved slot survives re-evaluation and respects jitter", async () => {
    const target1 = randomUUID();
    insertTarget(target1);
    const runId = randomUUID();
    insertRun(runId, accountId);
    
    const rpId = randomUUID();
    db.prepare("INSERT INTO run_profiles (id, run_id, target_id) VALUES (?, ?, ?)").run(rpId, runId, target1);
    
    const stateId = randomUUID();
    const step = { id: randomUUID(), step_type: 'linkedin_enrich' };
    const targetRow = db.prepare("SELECT * FROM targets WHERE id=?").get(target1);
    const runner = await import("../../lib/linkedin/runner");
    
    // Pre-set execution so it waits
    db.prepare(`INSERT INTO account_pacing_state (account_id, action_type, last_executed_at) VALUES (?, 'linkedin_enrich', ?)`).run(accountId, new Date().toISOString());
    
    // First eval
    const res1 = await runner.executeStep(db, runId, rpId, stateId, targetRow, step, accountId, {}, null, null, null, () => {});
    const slot1 = (res1 as any).next_eval_at;
    
    // Re-eval immediately
    const res2 = await runner.executeStep(db, runId, rpId, stateId, targetRow, step, accountId, {}, null, null, null, () => {});
    const slot2 = (res2 as any).next_eval_at;
    
    const t1 = new Date(slot1).getTime();
    const t2 = new Date(slot2).getTime();
    expect(t2 - t1).toBeGreaterThanOrEqual(300000); // 5 mins
  });
});
