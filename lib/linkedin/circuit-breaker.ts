import { getDb } from "@/lib/db";
import { log } from "./runner";

// Tracks consecutive failures per operation type in-memory
const failureCounts: Record<string, number> = {};
const THRESHOLD = 3;

export function recordSuccess(operation: string) {
  failureCounts[operation] = 0;
}

export function recordFailure(operation: string, errorMessage: string) {
  failureCounts[operation] = (failureCounts[operation] || 0) + 1;
  console.warn(`[circuit-breaker] Operation '${operation}' failed (${failureCounts[operation]}/${THRESHOLD}). Error: ${errorMessage}`);
  
  if (failureCounts[operation] >= THRESHOLD) {
    tripBreaker(operation, errorMessage);
  }
}

function tripBreaker(operation: string, errorMessage: string) {
  const db = getDb();
  console.error(`[circuit-breaker] 🚨 THRESHOLD REACHED FOR '${operation}'. TRIPPING BREAKER!`);
  
  // 1. Pause all active runs
  const runningRuns = db.prepare("SELECT id FROM runs WHERE status = 'running'").all() as { id: string }[];
  if (runningRuns.length > 0) {
    db.prepare("UPDATE runs SET status = 'paused' WHERE status = 'running'").run();
  }
  
  // 2. Write to app_settings to display banner in UI
  const alertData = JSON.stringify({
    operation,
    message: errorMessage,
    trippedAt: new Date().toISOString()
  });
  db.prepare("INSERT INTO app_settings (key, value) VALUES ('li_circuit_breaker', ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')").run(alertData, alertData);
  
  // 3. Log globally
  log(db, null, null, "error", `SYSTEM HALTED: LinkedIn automation broken during '${operation}'. All runs paused.`);
  
  // Reset so it doesn't infinitely trip if someone resumes without fixing, 
  // though it will just trip again after 3 failures.
  failureCounts[operation] = 0;
}

export function isBreakerTripped(): boolean {
  const db = getDb();
  const setting = db.prepare("SELECT value FROM app_settings WHERE key = 'li_circuit_breaker'").get() as { value: string } | undefined;
  return !!setting && !!setting.value;
}

export function resetBreaker() {
  const db = getDb();
  db.prepare("DELETE FROM app_settings WHERE key = 'li_circuit_breaker'").run();
  for (const key of Object.keys(failureCounts)) {
    failureCounts[key] = 0;
  }
  console.log(`[circuit-breaker] Reset manually.`);
}
