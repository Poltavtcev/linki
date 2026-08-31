"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordSuccess = recordSuccess;
exports.recordFailure = recordFailure;
exports.isBreakerTripped = isBreakerTripped;
exports.resetBreaker = resetBreaker;
var db_1 = require("@/lib/db");
var runner_1 = require("./runner");
// Tracks consecutive failures per operation type in-memory
var failureCounts = {};
var THRESHOLD = 3;
function recordSuccess(operation) {
    failureCounts[operation] = 0;
}
function recordFailure(operation, errorMessage) {
    failureCounts[operation] = (failureCounts[operation] || 0) + 1;
    console.warn("[circuit-breaker] Operation '".concat(operation, "' failed (").concat(failureCounts[operation], "/").concat(THRESHOLD, "). Error: ").concat(errorMessage));
    if (failureCounts[operation] >= THRESHOLD) {
        tripBreaker(operation, errorMessage);
    }
}
function tripBreaker(operation, errorMessage) {
    var db = (0, db_1.getDb)();
    console.error("[circuit-breaker] \uD83D\uDEA8 THRESHOLD REACHED FOR '".concat(operation, "'. TRIPPING BREAKER!"));
    // 1. Pause all active runs
    var runningRuns = db.prepare("SELECT id FROM runs WHERE status = 'running'").all();
    if (runningRuns.length > 0) {
        db.prepare("UPDATE runs SET status = 'paused' WHERE status = 'running'").run();
    }
    // 2. Write to app_settings to display banner in UI
    var alertData = JSON.stringify({
        operation: operation,
        message: errorMessage,
        trippedAt: new Date().toISOString()
    });
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('li_circuit_breaker', ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')").run(alertData, alertData);
    // 3. Log globally
    (0, runner_1.log)(db, null, null, "error", "SYSTEM HALTED: LinkedIn automation broken during '".concat(operation, "'. All runs paused."));
    // Reset so it doesn't infinitely trip if someone resumes without fixing, 
    // though it will just trip again after 3 failures.
    failureCounts[operation] = 0;
}
function isBreakerTripped() {
    var db = (0, db_1.getDb)();
    var setting = db.prepare("SELECT value FROM app_settings WHERE key = 'li_circuit_breaker'").get();
    return !!setting && !!setting.value;
}
function resetBreaker() {
    var db = (0, db_1.getDb)();
    db.prepare("DELETE FROM app_settings WHERE key = 'li_circuit_breaker'").run();
    for (var _i = 0, _a = Object.keys(failureCounts); _i < _a.length; _i++) {
        var key = _a[_i];
        failureCounts[key] = 0;
    }
    console.log("[circuit-breaker] Reset manually.");
}
