"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
var better_sqlite3_1 = __importDefault(require("better-sqlite3"));
var path_1 = __importDefault(require("path"));
var crypto_1 = require("crypto");
var update_check_1 = require("@/lib/update-check");
var crypto_2 = require("@/lib/crypto");
var DB_PATH = process.env.LINKI_DB_PATH || path_1.default.join(process.cwd(), "linki.db");
var db;
function getDb() {
    if (!db) {
        db = new better_sqlite3_1.default(DB_PATH);
        db.pragma("journal_mode = WAL");
        db.pragma("foreign_keys = ON");
        initDb(db);
        runMigrations(db);
        (0, update_check_1.scheduleUpdateCheck)();
    }
    // Safely migrate track CHECK constraint for run_profile_tracks
    try {
        var tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='run_profile_tracks'").get();
        if (tableInfo && !tableInfo.sql.includes("'integration'")) {
            db.exec("PRAGMA foreign_keys = OFF;");
            var columnsQuery = db.prepare("PRAGMA table_info(run_profile_tracks)").all();
            var colNames = columnsQuery.map(function (c) { return c.name; });
            var createSql = "CREATE TABLE run_profile_tracks_new (\n      id TEXT PRIMARY KEY,\n      run_profile_id TEXT NOT NULL REFERENCES run_profiles(id) ON DELETE CASCADE,\n      track TEXT NOT NULL CHECK(track IN ('linkedin', 'email', 'integration')),\n      state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),\n      current_step INTEGER NOT NULL DEFAULT 0,\n      last_step_at TEXT,\n      next_step_at TEXT,\n      error_message TEXT,\n      last_email_subject TEXT,\n      last_email_body TEXT";
            for (var _i = 0, columnsQuery_1 = columnsQuery; _i < columnsQuery_1.length; _i++) {
                var col = columnsQuery_1[_i];
                if (!['id', 'run_profile_id', 'track', 'state', 'current_step', 'last_step_at', 'next_step_at', 'error_message', 'last_email_subject', 'last_email_body'].includes(col.name)) {
                    createSql += ", ".concat(col.name, " ").concat(col.type);
                }
            }
            createSql += ");";
            db.exec(createSql);
            var colList = colNames.join(', ');
            db.exec("INSERT INTO run_profile_tracks_new (".concat(colList, ") SELECT ").concat(colList, " FROM run_profile_tracks;"));
            db.exec("DROP TABLE run_profile_tracks;");
            db.exec("ALTER TABLE run_profile_tracks_new RENAME TO run_profile_tracks;");
            db.exec("PRAGMA foreign_keys = ON;");
        }
    }
    catch (err) {
        console.error("Migration error run_profile_tracks:", err);
    }
    // Safely migrate track CHECK constraint for workflow_steps
    try {
        var tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='workflow_steps'").get();
        if (tableInfo && !tableInfo.sql.includes("'change_status'")) {
            db.exec("PRAGMA foreign_keys = OFF;");
            var columnsQuery = db.prepare("PRAGMA table_info(workflow_steps)").all();
            var colNames = columnsQuery.map(function (c) { return c.name; });
            var createSql = "CREATE TABLE workflow_steps_new (\n      id TEXT PRIMARY KEY,\n      workflow_id TEXT REFERENCES workflows(id) ON DELETE CASCADE,\n      step_order INTEGER NOT NULL,\n      step_type TEXT NOT NULL CHECK(step_type IN ('visit', 'connect', 'message', 'delay', 'email', 'sales_inmail', 'integration', 'change_status')),\n      template_id TEXT REFERENCES templates(id),\n      delay_seconds INTEGER DEFAULT 0,\n      connect_note TEXT,\n      message_body TEXT,\n      enabled INTEGER DEFAULT 1,\n      config TEXT";
            for (var _a = 0, columnsQuery_2 = columnsQuery; _a < columnsQuery_2.length; _a++) {
                var col = columnsQuery_2[_a];
                if (!['id', 'workflow_id', 'step_order', 'step_type', 'template_id', 'delay_seconds', 'connect_note', 'message_body', 'enabled', 'config'].includes(col.name)) {
                    createSql += ", ".concat(col.name, " ").concat(col.type);
                }
            }
            createSql += ");";
            db.exec(createSql);
            var colList = colNames.join(', ');
            db.exec("INSERT INTO workflow_steps_new (".concat(colList, ") SELECT ").concat(colList, " FROM workflow_steps;"));
            db.exec("DROP TABLE workflow_steps;");
            db.exec("ALTER TABLE workflow_steps_new RENAME TO workflow_steps;");
            db.exec("PRAGMA foreign_keys = ON;");
        }
    }
    catch (err) {
        console.error("Migration error workflow_steps:", err);
    }
    try {
        var tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='workflow_steps'").get();
        if (tableInfo && tableInfo.sql.includes("CHECK(track IN") && !tableInfo.sql.includes("'integration'", tableInfo.sql.indexOf("CHECK(track IN"))) {
            db.exec("PRAGMA foreign_keys = OFF;");
            var columnsQuery = db.prepare("PRAGMA table_info(workflow_steps)").all();
            var colNames = columnsQuery.map(function (c) { return c.name; });
            var createSql = "CREATE TABLE workflow_steps_new (\n        id TEXT PRIMARY KEY,\n        workflow_id TEXT REFERENCES workflows(id) ON DELETE CASCADE,\n        step_order INTEGER NOT NULL,\n        step_type TEXT NOT NULL CHECK(step_type IN ('visit', 'connect', 'message', 'sales_inmail', 'delay', 'email', 'integration')),\n        template_id TEXT REFERENCES templates(id),\n        track TEXT NOT NULL DEFAULT 'linkedin' CHECK(track IN ('linkedin', 'email', 'integration'))";
            for (var _b = 0, columnsQuery_3 = columnsQuery; _b < columnsQuery_3.length; _b++) {
                var col = columnsQuery_3[_b];
                if (!['id', 'workflow_id', 'step_order', 'step_type', 'template_id', 'track'].includes(col.name)) {
                    createSql += ", ".concat(col.name, " ").concat(col.type);
                }
            }
            createSql += ");";
            db.exec(createSql);
            var colList = colNames.join(', ');
            db.exec("INSERT INTO workflow_steps_new (".concat(colList, ") SELECT ").concat(colList, " FROM workflow_steps;"));
            db.exec("DROP TABLE workflow_steps;");
            db.exec("ALTER TABLE workflow_steps_new RENAME TO workflow_steps;");
            db.exec("PRAGMA foreign_keys = ON;");
        }
    }
    catch (err) {
        console.error("Migration error workflow_steps track:", err);
    }
    return db;
}
function runParallelTracksMigration(db) {
    // This backfill reads the legacy run_profiles.state column. If that column no longer
    // exists, dropDeprecatedRunProfileColumns has already run (a prior startup) and this
    // migration is moot — skip, otherwise the SELECT rp.state below throws "no such column".
    // (Fresh DBs hit this: state is created, dropped on one startup, then this guard would
    // otherwise re-enter on the next because no email-tracked steps exist yet.)
    try {
        var rpCols = db.prepare("PRAGMA table_info(run_profiles)").all();
        if (!rpCols.some(function (c) { return c.name === "state"; }))
            return;
    }
    catch (_a) {
        return;
    }
    // Idempotent: skip if run_profile_tracks already has rows or workflow_steps already has email-tracked rows
    try {
        var alreadyRun = db.prepare("SELECT COUNT(*) as c FROM run_profile_tracks").get().c > 0
            || db.prepare("SELECT COUNT(*) as c FROM workflow_steps WHERE track = 'email'").get().c > 0;
        if (alreadyRun)
            return;
    }
    catch (_b) {
        return;
    }
    db.transaction(function () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        // 1. Assign email step_type rows to the email track
        db.exec("UPDATE workflow_steps SET track = 'email' WHERE step_type = 'email'");
        // Also assign delay steps to the email track if the next non-delay step after them is an email step.
        // Without this, delays between email steps default to 'linkedin' and create a ghost linkedin track.
        db.exec("\n      UPDATE workflow_steps SET track = 'email'\n      WHERE step_type = 'delay'\n      AND (\n        SELECT step_type FROM workflow_steps ws2\n        WHERE ws2.workflow_id = workflow_steps.workflow_id\n          AND ws2.step_order > workflow_steps.step_order\n          AND ws2.step_type != 'delay'\n        ORDER BY ws2.step_order ASC\n        LIMIT 1\n      ) = 'email'\n    ");
        // 2. Re-number step_order densely within each (workflow_id, track), preserving original order
        var stepGroups = db.prepare("SELECT id, workflow_id, track, step_order FROM workflow_steps ORDER BY workflow_id, track, step_order").all();
        // Group by (workflow_id, track) and assign dense 1-based order
        var grouped = new Map();
        for (var _i = 0, stepGroups_1 = stepGroups; _i < stepGroups_1.length; _i++) {
            var row = stepGroups_1[_i];
            var key = "".concat(row.workflow_id, "|").concat(row.track);
            if (!grouped.has(key))
                grouped.set(key, []);
            grouped.get(key).push({ id: row.id, step_order: row.step_order });
        }
        var updateStep = db.prepare("UPDATE workflow_steps SET step_order = ? WHERE id = ?");
        for (var _j = 0, _k = grouped.values(); _j < _k.length; _j++) {
            var steps = _k[_j];
            steps.sort(function (a, b) { return a.step_order - b.step_order; });
            steps.forEach(function (s, i) { return updateStep.run(i + 1, s.id); });
        }
        // 3. Backfill run_profile_tracks from existing run_profiles
        // Only backfill if there are run_profiles rows to process
        var allProfiles = db.prepare("SELECT rp.id, rp.run_id, rp.state, rp.current_step, rp.next_step_at,\n              rp.error_message, rp.last_email_subject, rp.last_email_body, rp.last_linkedin_message,\n              r.workflow_id\n       FROM run_profiles rp\n       JOIN runs r ON r.id = rp.run_id").all();
        if (allProfiles.length === 0)
            return;
        // Load all workflow steps grouped by workflow_id, preserving their original ordering
        // We need the ORIGINAL step_order to map legacy current_step (0-based flat index) to tracks.
        // After the re-numbering above, step_order is now per-track. We stored the original order as the
        // sort key inside stepGroups above. Rebuild a per-workflow flat list from the original ordering.
        var workflowStepsOrig = db.prepare("SELECT id, workflow_id, track, step_order FROM workflow_steps ORDER BY workflow_id, step_order").all();
        // For each workflow, build the flat list of steps in their original order (by new step_order within track, then track order linkedin < email)
        // BUT: we need the ORIGINAL flat order before re-numbering. Since we already re-numbered, we have to reconstruct.
        // Approach: the original flat step_order was cross-track. The re-numbered step_order is per-track and starts at 1.
        // We stored the original step_order in stepGroups (before modification). Use that.
        var origStepOrderMap = new Map(); // step id → original flat step_order
        for (var _l = 0, stepGroups_2 = stepGroups; _l < stepGroups_2.length; _l++) {
            var row = stepGroups_2[_l];
            origStepOrderMap.set(row.id, row.step_order);
        }
        // Per workflow: flat list of steps sorted by original step_order
        var workflowFlatSteps = new Map();
        for (var _m = 0, workflowStepsOrig_1 = workflowStepsOrig; _m < workflowStepsOrig_1.length; _m++) {
            var step = workflowStepsOrig_1[_m];
            if (!workflowFlatSteps.has(step.workflow_id))
                workflowFlatSteps.set(step.workflow_id, []);
            workflowFlatSteps.get(step.workflow_id).push({
                id: step.id,
                track: step.track,
                orig_order: (_a = origStepOrderMap.get(step.id)) !== null && _a !== void 0 ? _a : step.step_order,
            });
        }
        for (var _o = 0, _p = workflowFlatSteps.values(); _o < _p.length; _o++) {
            var steps = _p[_o];
            steps.sort(function (a, b) { return a.orig_order - b.orig_order; });
        }
        // Per workflow: which tracks exist
        var workflowTracks = new Map();
        for (var _q = 0, workflowStepsOrig_2 = workflowStepsOrig; _q < workflowStepsOrig_2.length; _q++) {
            var step = workflowStepsOrig_2[_q];
            if (!workflowTracks.has(step.workflow_id))
                workflowTracks.set(step.workflow_id, new Set());
            workflowTracks.get(step.workflow_id).add(step.track);
        }
        var insertTrack = db.prepare("\n      INSERT OR IGNORE INTO run_profile_tracks\n        (id, run_profile_id, track, state, current_step, last_step_at, next_step_at,\n         error_message, last_email_subject, last_email_body, last_linkedin_message)\n      VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)\n    ");
        for (var _r = 0, allProfiles_1 = allProfiles; _r < allProfiles_1.length; _r++) {
            var rp = allProfiles_1[_r];
            var flatSteps = (_b = workflowFlatSteps.get(rp.workflow_id)) !== null && _b !== void 0 ? _b : [];
            var tracks = (_c = workflowTracks.get(rp.workflow_id)) !== null && _c !== void 0 ? _c : new Set(["linkedin"]);
            var terminalStates = new Set(["completed", "failed", "skipped"]);
            if (terminalStates.has(rp.state)) {
                // Terminal profile — mark all tracks with the same terminal state
                for (var _s = 0, tracks_1 = tracks; _s < tracks_1.length; _s++) {
                    var track = tracks_1[_s];
                    insertTrack.run((0, crypto_1.randomUUID)(), rp.id, track, rp.state, 0, null, (_d = rp.error_message) !== null && _d !== void 0 ? _d : null, null, null, null);
                }
                continue;
            }
            // Active profile — compute per-track completed step count
            // legacy current_step is 0-based index into the flat step list = steps already completed
            var completedCount = rp.current_step;
            var completedSteps = flatSteps.slice(0, completedCount);
            var trackCompletedCount = new Map();
            for (var _t = 0, tracks_2 = tracks; _t < tracks_2.length; _t++) {
                var track = tracks_2[_t];
                trackCompletedCount.set(track, 0);
            }
            for (var _u = 0, completedSteps_1 = completedSteps; _u < completedSteps_1.length; _u++) {
                var s = completedSteps_1[_u];
                trackCompletedCount.set(s.track, ((_e = trackCompletedCount.get(s.track)) !== null && _e !== void 0 ? _e : 0) + 1);
            }
            // Which track owned the step we were waiting on (index = completedCount)?
            var currentFlatStep = flatSteps[completedCount];
            var waitingTrack = (_f = currentFlatStep === null || currentFlatStep === void 0 ? void 0 : currentFlatStep.track) !== null && _f !== void 0 ? _f : null;
            for (var _v = 0, tracks_3 = tracks; _v < tracks_3.length; _v++) {
                var track = tracks_3[_v];
                var trackCurrentStep = (_g = trackCompletedCount.get(track)) !== null && _g !== void 0 ? _g : 0;
                // next_step_at: only carry over to the track that was waiting; other track starts immediately
                var nextStepAt = track === waitingTrack ? rp.next_step_at : null;
                var lastEmailSubject = track === "email" ? rp.last_email_subject : null;
                var lastEmailBody = track === "email" ? rp.last_email_body : null;
                var lastLinkedinMessage = track === "linkedin" ? rp.last_linkedin_message : null;
                insertTrack.run((0, crypto_1.randomUUID)(), rp.id, track, rp.state, trackCurrentStep, nextStepAt, (_h = rp.error_message) !== null && _h !== void 0 ? _h : null, lastEmailSubject, lastEmailBody, lastLinkedinMessage);
            }
        }
    })();
}
function dropDeprecatedRunProfileColumns(db) {
    // Idempotent: check if state column still exists on run_profiles
    try {
        var tableInfo = db.prepare("PRAGMA table_info(run_profiles)").all();
        var hasState = tableInfo.some(function (c) { return c.name === "state"; });
        if (!hasState)
            return; // already dropped
    }
    catch (_a) {
        return;
    }
    // SQLite requires a table rebuild to drop columns
    try {
        db.exec("\n      PRAGMA foreign_keys = OFF;\n      CREATE TABLE run_profiles_new (\n        id TEXT PRIMARY KEY,\n        run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,\n        target_id TEXT REFERENCES targets(id) ON DELETE CASCADE,\n        email_account_id TEXT,\n        created_at TEXT DEFAULT (datetime('now')),\n        UNIQUE(run_id, target_id)\n      );\n      INSERT INTO run_profiles_new (id, run_id, target_id, email_account_id, created_at)\n        SELECT id, run_id, target_id, email_account_id, created_at FROM run_profiles;\n      DROP TABLE run_profiles;\n      ALTER TABLE run_profiles_new RENAME TO run_profiles;\n      PRAGMA foreign_keys = ON;\n    ");
    }
    catch ( /* ignore — may already be done */_b) { /* ignore — may already be done */ }
}
function runMigrations(db) {
    // Migration: Add ON DELETE CASCADE to target references
    try {
        var tableInfo = db.prepare("PRAGMA foreign_key_list(run_profiles)").all();
        var hasCascade = tableInfo.some(function (fk) { return fk.table === 'targets' && fk.on_delete === 'CASCADE'; });
        if (!hasCascade) {
            db.exec("\n        PRAGMA foreign_keys = OFF;\n        \n        CREATE TABLE run_profiles_new (\n          id TEXT PRIMARY KEY,\n          run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,\n          target_id TEXT REFERENCES targets(id) ON DELETE CASCADE,\n          email_account_id TEXT,\n          created_at TEXT DEFAULT (datetime('now')),\n          UNIQUE(run_id, target_id)\n        );\n        INSERT INTO run_profiles_new (id, run_id, target_id, email_account_id, created_at)\n          SELECT id, run_id, target_id, email_account_id, created_at FROM run_profiles;\n        DROP TABLE run_profiles;\n        ALTER TABLE run_profiles_new RENAME TO run_profiles;\n        \n        CREATE TABLE logs_new (\n          id TEXT PRIMARY KEY,\n          run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,\n          target_id TEXT REFERENCES targets(id) ON DELETE CASCADE,\n          level TEXT DEFAULT 'info' CHECK(level IN ('info', 'warn', 'error')),\n          message TEXT NOT NULL,\n          created_at TEXT DEFAULT (datetime('now'))\n        );\n        INSERT INTO logs_new SELECT * FROM logs;\n        DROP TABLE logs;\n        ALTER TABLE logs_new RENAME TO logs;\n        \n        CREATE TABLE agent_sessions_new (\n          id TEXT PRIMARY KEY,\n          run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,\n          target_id TEXT REFERENCES targets(id) ON DELETE CASCADE,\n          step_id TEXT,\n          model TEXT,\n          input_tokens INTEGER,\n          output_tokens INTEGER,\n          cost_usd REAL,\n          prompt TEXT,\n          generated_text TEXT,\n          created_at TEXT DEFAULT (datetime('now'))\n        );\n        INSERT INTO agent_sessions_new SELECT * FROM agent_sessions;\n        DROP TABLE agent_sessions;\n        ALTER TABLE agent_sessions_new RENAME TO agent_sessions;\n\n        CREATE TABLE email_replies_new (\n          id TEXT PRIMARY KEY,\n          target_id TEXT NOT NULL REFERENCES targets(id) ON DELETE CASCADE,\n          run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,\n          message_id TEXT,\n          in_reply_to TEXT,\n          from_email TEXT NOT NULL,\n          subject TEXT,\n          body_text TEXT NOT NULL,\n          received_at TEXT NOT NULL,\n          classified_at TEXT,\n          classification_json TEXT,\n          classification_error TEXT,\n          dispatched_at TEXT,\n          dispatch_result_json TEXT,\n          manually_edited INTEGER NOT NULL DEFAULT 0,\n          created_at TEXT NOT NULL DEFAULT (datetime('now'))\n        );\n        INSERT INTO email_replies_new (\n          id, target_id, run_id, message_id, in_reply_to, from_email, subject, body_text,\n          received_at, classified_at, classification_json, classification_error,\n          dispatched_at, dispatch_result_json, manually_edited, created_at\n        )\n        SELECT \n          id, target_id, run_id, NULL as message_id, NULL as in_reply_to, from_email, subject, body_text,\n          received_at, classified_at, classification_json, classification_error,\n          dispatched_at, dispatch_result_json, manually_edited, created_at\n        FROM email_replies;\n        DROP TABLE email_replies;\n        ALTER TABLE email_replies_new RENAME TO email_replies;\n        CREATE UNIQUE INDEX IF NOT EXISTS idx_email_replies_target_msg ON email_replies(target_id, message_id) WHERE message_id IS NOT NULL;\n\n        \n        PRAGMA foreign_keys = ON;\n      ");
        }
    }
    catch (e) {
        console.error("Migration error (cascade):", e);
    }
    // Add columns introduced after initial schema — safe to run on existing DBs
    var migrations = [
        "ALTER TABLE workflow_steps ADD COLUMN config TEXT",
        "ALTER TABLE integrations ADD COLUMN is_active INTEGER DEFAULT 1",
        "ALTER TABLE integrations ADD COLUMN credits_remaining INTEGER",
        "ALTER TABLE integrations ADD COLUMN quota_resets_at TEXT",
        "CREATE TABLE IF NOT EXISTS linkedin_reply_queue (\n      id TEXT PRIMARY KEY,\n      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,\n      target_id TEXT NOT NULL REFERENCES targets(id) ON DELETE CASCADE,\n      thread_id TEXT NOT NULL,\n      body TEXT NOT NULL,\n      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),\n      error_message TEXT,\n      created_at TEXT NOT NULL DEFAULT (datetime('now')),\n      completed_at TEXT\n    )",
        // Automatic withdrawal of old pending invites
        "ALTER TABLE accounts ADD COLUMN withdraw_invites_after_days INTEGER DEFAULT 14",
        "ALTER TABLE targets ADD COLUMN degree INTEGER",
        "ALTER TABLE targets ADD COLUMN connection_requested_at TEXT",
        "ALTER TABLE targets ADD COLUMN connected_at TEXT",
        "ALTER TABLE targets ADD COLUMN message_sent_at TEXT",
        "ALTER TABLE targets ADD COLUMN last_replied_at TEXT",
        "ALTER TABLE targets ADD COLUMN linkedin_member_urn TEXT",
        "ALTER TABLE targets ADD COLUMN sales_nav_url TEXT",
        "ALTER TABLE lists ADD COLUMN sales_nav_url TEXT",
        "ALTER TABLE accounts ADD COLUMN inbox_synced_at TEXT",
        "ALTER TABLE accounts ADD COLUMN active_hours_start INTEGER DEFAULT 9",
        "ALTER TABLE accounts ADD COLUMN active_hours_end INTEGER DEFAULT 18",
        "ALTER TABLE accounts ADD COLUMN timezone TEXT DEFAULT 'UTC'",
        "ALTER TABLE accounts ADD COLUMN working_days TEXT DEFAULT '1,2,3,4,5'",
        "ALTER TABLE workflow_steps ADD COLUMN connect_note TEXT",
        "ALTER TABLE workflow_steps ADD COLUMN message_body TEXT",
        "ALTER TABLE targets ADD COLUMN headline TEXT",
        "ALTER TABLE targets ADD COLUMN summary TEXT",
        "ALTER TABLE accounts ADD COLUMN accepted_sync_at TEXT",
        // Messaging identity (fsd_profile URN, "urn:li:fsd_profile:ACoAA...") — the
        // form the messaging GraphQL API returns. It is NOT convertible to the
        // numeric urn:li:member we store elsewhere, so we capture it on first reply
        // (matched by name) and then join by it directly on every later sync.
        "ALTER TABLE targets ADD COLUMN messaging_urn TEXT",
        "CREATE INDEX IF NOT EXISTS idx_targets_messaging_urn ON targets(messaging_urn)",
        // Boundary for the incremental connections sync: the createdAt of the newest
        // connection seen last run. NULL = never synced (first run does a full pass).
        "ALTER TABLE accounts ADD COLUMN connections_synced_through_ms INTEGER",
        "ALTER TABLE accounts ADD COLUMN li_connections INTEGER",
        "ALTER TABLE accounts ADD COLUMN li_pending INTEGER",
        "ALTER TABLE accounts ADD COLUMN li_profile_views INTEGER",
        "ALTER TABLE accounts ADD COLUMN li_stats_synced_at TEXT",
        "CREATE TABLE IF NOT EXISTS workflow_step_templates (\n      step_id TEXT REFERENCES workflow_steps(id) ON DELETE CASCADE,\n      template_id TEXT REFERENCES templates(id) ON DELETE CASCADE,\n      PRIMARY KEY (step_id, template_id)\n    )",
        // Extended lead data from salesApiLeadSearch
        "ALTER TABLE targets ADD COLUMN object_urn TEXT",
        "ALTER TABLE targets ADD COLUMN open_link INTEGER DEFAULT 0",
        "ALTER TABLE targets ADD COLUMN company_industry TEXT",
        "ALTER TABLE targets ADD COLUMN company_location TEXT",
        "ALTER TABLE targets ADD COLUMN tenure_months INTEGER",
        "ALTER TABLE targets ADD COLUMN spotlight_badges TEXT",
        // Profile enrichment — populated by visiting their Sales Nav profile page
        "ALTER TABLE targets ADD COLUMN positions_json TEXT",
        "ALTER TABLE targets ADD COLUMN skills_json TEXT",
        "ALTER TABLE targets ADD COLUMN enriched_profile_at TEXT",
        // Email outreach fields
        "ALTER TABLE targets ADD COLUMN email TEXT",
        "ALTER TABLE targets ADD COLUMN email_replied_at TEXT",
        "ALTER TABLE targets ADD COLUMN company_id TEXT",
        // Email account on runs (nullable — only needed when workflow has email steps)
        "ALTER TABLE runs ADD COLUMN email_account_id TEXT REFERENCES email_accounts(id)",
        // Workflow step email fields
        "ALTER TABLE workflow_steps ADD COLUMN email_subject TEXT",
        "ALTER TABLE workflow_steps ADD COLUMN email_body TEXT",
        // Apollo enrichment fields
        "ALTER TABLE targets ADD COLUMN apollo_id TEXT",
        "ALTER TABLE targets ADD COLUMN seniority TEXT",
        "ALTER TABLE targets ADD COLUMN apollo_functions TEXT",
        "ALTER TABLE targets ADD COLUMN company_description TEXT",
        "ALTER TABLE targets ADD COLUMN company_size INTEGER",
        "ALTER TABLE targets ADD COLUMN apollo_enriched_at TEXT",
        "ALTER TABLE targets ADD COLUMN email_status TEXT",
        // Manual fields
        "ALTER TABLE targets ADD COLUMN notes TEXT",
        // Apollo extra person fields
        "ALTER TABLE targets ADD COLUMN city TEXT",
        "ALTER TABLE targets ADD COLUMN country TEXT",
        "ALTER TABLE targets ADD COLUMN time_zone TEXT",
        "ALTER TABLE targets ADD COLUMN apollo_departments TEXT",
        // Apollo extra company fields on companies table
        "ALTER TABLE companies ADD COLUMN founded_year INTEGER",
        "ALTER TABLE companies ADD COLUMN logo_url TEXT",
        "ALTER TABLE companies ADD COLUMN phone TEXT",
        "ALTER TABLE companies ADD COLUMN annual_revenue TEXT",
        "ALTER TABLE companies ADD COLUMN technology_names TEXT",
        "ALTER TABLE companies ADD COLUMN keywords TEXT",
        "ALTER TABLE companies ADD COLUMN city TEXT",
        "ALTER TABLE companies ADD COLUMN country TEXT",
        // Email signature
        "ALTER TABLE email_accounts ADD COLUMN signature TEXT",
        // Reply-To override — if set, outgoing emails include Reply-To header
        "ALTER TABLE email_accounts ADD COLUMN reply_to TEXT",
        // Ramp-up: start slow and increase sending volume over time
        "ALTER TABLE email_accounts ADD COLUMN ramp_up_enabled INTEGER DEFAULT 1",
        "ALTER TABLE email_accounts ADD COLUMN ramp_start_date TEXT",
        // Company description and employee count moved from targets to companies
        "ALTER TABLE companies ADD COLUMN description TEXT",
        "ALTER TABLE companies ADD COLUMN employee_count INTEGER",
        // AI agent columns on workflow steps
        "ALTER TABLE workflow_steps ADD COLUMN ai_enabled INTEGER DEFAULT 0",
        "ALTER TABLE workflow_steps ADD COLUMN ai_model TEXT",
        "ALTER TABLE workflow_steps ADD COLUMN ai_prompt TEXT",
        "ALTER TABLE workflow_steps ADD COLUMN ai_max_words INTEGER",
        // Email step position — which followup number (1 = cold email, 2 = first followup, etc.)
        "ALTER TABLE workflow_steps ADD COLUMN email_position INTEGER DEFAULT 1",
        // Agent default model (stored on agent_config)
        "ALTER TABLE agent_config ADD COLUMN default_model TEXT",
        // Email threading — store sent email message-id for reply threading (future use)
        "ALTER TABLE run_profiles ADD COLUMN last_email_subject TEXT",
        "ALTER TABLE run_profiles ADD COLUMN last_email_body TEXT",
        // LinkedIn message follow-up tracking
        "ALTER TABLE workflow_steps ADD COLUMN message_position INTEGER DEFAULT 1",
        "ALTER TABLE run_profiles ADD COLUMN last_linkedin_message TEXT",
        // Language for AI-generated content per step
        "ALTER TABLE workflow_steps ADD COLUMN ai_language TEXT DEFAULT 'English'",
        // Campaign-level prompt — per-workflow AI context (USP, persona, tone for this campaign)
        "ALTER TABLE workflows ADD COLUMN prompt TEXT",
        // Email domain invalid flag on companies — set when a bounce is detected for any contact at this company
        "ALTER TABLE companies ADD COLUMN email_domain_invalid INTEGER DEFAULT 0",
        // Apollo extra person fields
        "ALTER TABLE targets ADD COLUMN email_domain_catchall INTEGER DEFAULT 0",
        // Per-profile email account assignment (multi-account routing)
        "ALTER TABLE run_profiles ADD COLUMN email_account_id TEXT",
        // Backfill: copy email_account_id from runs → run_profiles for existing records
        "UPDATE run_profiles SET email_account_id = (SELECT email_account_id FROM runs WHERE runs.id = run_profiles.run_id) WHERE email_account_id IS NULL",
        // Import job progress tracking
        "CREATE TABLE IF NOT EXISTS list_imports (\n      id TEXT PRIMARY KEY,\n      list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,\n      status TEXT NOT NULL DEFAULT 'running',\n      phase TEXT,\n      page INTEGER DEFAULT 0,\n      total_pages INTEGER DEFAULT 0,\n      count INTEGER DEFAULT 0,\n      total INTEGER DEFAULT 0,\n      imported INTEGER DEFAULT 0,\n      skipped INTEGER DEFAULT 0,\n      error TEXT,\n      started_at TEXT NOT NULL DEFAULT (datetime('now')),\n      finished_at TEXT\n    )",
        // Parallel tracks: add track column to workflow_steps
        "ALTER TABLE workflow_steps ADD COLUMN track TEXT NOT NULL DEFAULT 'linkedin' CHECK(track IN ('linkedin', 'email'))",
        // Parallel tracks: create run_profile_tracks table
        "CREATE TABLE IF NOT EXISTS run_profile_tracks (\n      id TEXT PRIMARY KEY,\n      run_profile_id TEXT NOT NULL REFERENCES run_profiles(id) ON DELETE CASCADE,\n      track TEXT NOT NULL CHECK(track IN ('linkedin', 'email', 'integration')),\n      state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),\n      current_step INTEGER NOT NULL DEFAULT 0,\n      last_step_at TEXT,\n      next_step_at TEXT,\n      error_message TEXT,\n      last_email_subject TEXT,\n      last_email_body TEXT,\n      last_email_message_id TEXT,\n      last_linkedin_message TEXT,\n      created_at TEXT NOT NULL DEFAULT (datetime('now')),\n      UNIQUE(run_profile_id, track)\n    )",
        "CREATE INDEX IF NOT EXISTS idx_run_profile_tracks_run_profile_id ON run_profile_tracks(run_profile_id)",
        "CREATE INDEX IF NOT EXISTS idx_run_profile_tracks_state_next ON run_profile_tracks(state, next_step_at)",
        // Drop deprecated columns from run_profiles — all consumers now read from run_profile_tracks
        // SQLite does not support DROP COLUMN directly before 3.35; handled via table rebuild below
        // Separate IMAP credentials for custom mail providers where SMTP ≠ IMAP auth
        "ALTER TABLE email_accounts ADD COLUMN imap_username TEXT",
        "ALTER TABLE email_accounts ADD COLUMN imap_password TEXT",
        "ALTER TABLE workflows ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0",
        // Per-step signature override for email steps (null = use email account default)
        "ALTER TABLE workflow_steps ADD COLUMN email_signature TEXT",
        // CRM: todos per contact
        "CREATE TABLE IF NOT EXISTS todos (\n      id TEXT PRIMARY KEY,\n      target_id TEXT NOT NULL REFERENCES targets(id) ON DELETE CASCADE,\n      title TEXT NOT NULL,\n      due_date TEXT,\n      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'done')),\n      created_at TEXT NOT NULL DEFAULT (datetime('now'))\n    )",
        "CREATE INDEX IF NOT EXISTS idx_todos_target_id ON todos(target_id)",
        "CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status)",
        "ALTER TABLE todos ADD COLUMN description TEXT",
        // CRM: activity log per contact
        "CREATE TABLE IF NOT EXISTS activity_logs (\n      id TEXT PRIMARY KEY,\n      target_id TEXT NOT NULL REFERENCES targets(id) ON DELETE CASCADE,\n      type TEXT NOT NULL DEFAULT 'note' CHECK(type IN ('call', 'email', 'meeting', 'note', 'other')),\n      body TEXT NOT NULL,\n      logged_at TEXT NOT NULL DEFAULT (datetime('now')),\n      created_at TEXT NOT NULL DEFAULT (datetime('now'))\n    )",
        "CREATE INDEX IF NOT EXISTS idx_activity_logs_target_id ON activity_logs(target_id)",
        // Reply classifier: captured email replies + classifier verdict + dispatcher result
        "CREATE TABLE IF NOT EXISTS email_replies (\n      id TEXT PRIMARY KEY,\n      target_id TEXT NOT NULL REFERENCES targets(id) ON DELETE CASCADE,\n      run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,\n      message_id TEXT,\n      in_reply_to TEXT,\n      from_email TEXT NOT NULL,\n      subject TEXT,\n      body_text TEXT NOT NULL,\n      received_at TEXT NOT NULL,\n      classified_at TEXT,\n      classification_json TEXT,\n      classification_error TEXT,\n      dispatched_at TEXT,\n      dispatch_result_json TEXT,\n      manually_edited INTEGER NOT NULL DEFAULT 0,\n      created_at TEXT NOT NULL DEFAULT (datetime('now'))\n    )",
        "CREATE INDEX IF NOT EXISTS idx_email_replies_target_id ON email_replies(target_id)",
        "CREATE INDEX IF NOT EXISTS idx_email_replies_dispatched_at ON email_replies(dispatched_at)",
        // Reply classifier verdict stamped on the target — enables reply-rate-by-kind metrics
        "ALTER TABLE targets ADD COLUMN reply_kind TEXT",
        "ALTER TABLE targets ADD COLUMN inmail_sent_at TEXT",
        "ALTER TABLE targets ADD COLUMN posts_json TEXT", // recent posts from visit_profile
        "ALTER TABLE targets ADD COLUMN posts_scraped_at TEXT",
        // One-shot OOO reply context for the AI follow-up writer — set by the dispatcher,
        // read + cleared by the runner on the next email send. Distinct from last_email_body
        // (which holds the last email WE sent, used for follow-up threading).
        "ALTER TABLE email_accounts ADD COLUMN inbox_last_uid INTEGER",
        "ALTER TABLE email_accounts ADD COLUMN inbox_uidvalidity INTEGER",
        "ALTER TABLE run_profile_tracks ADD COLUMN last_email_message_id TEXT",
        "ALTER TABLE run_profile_tracks ADD COLUMN pending_reply_context TEXT",
        // Removed the in-app chat agent (replaced by the hosted MCP endpoint at /api/mcp) — drop its tables.
        "DROP TABLE IF EXISTS chat_messages",
        "DROP TABLE IF EXISTS chat_sessions",
        // Batched/scheduled imports — split large lists across days under a daily cap.
        "ALTER TABLE list_imports ADD COLUMN account_id TEXT",
        "ALTER TABLE list_imports ADD COLUMN sales_nav_url TEXT",
        "ALTER TABLE list_imports ADD COLUMN scheduled_for TEXT", // 'YYYY-MM-DD'; NULL = run now
        "ALTER TABLE list_imports ADD COLUMN start_page INTEGER DEFAULT 1",
        "ALTER TABLE list_imports ADD COLUMN cap INTEGER", // max contacts for this batch
        "ALTER TABLE list_imports ADD COLUMN cancel_requested INTEGER DEFAULT 0",
        "ALTER TABLE list_imports ADD COLUMN batch_index INTEGER DEFAULT 1",
        "ALTER TABLE list_imports ADD COLUMN enrich INTEGER DEFAULT 0",
        "CREATE INDEX IF NOT EXISTS idx_list_imports_scheduled ON list_imports(status, scheduled_for)",
        // Simple app-wide key/value settings (e.g. daily_import_cap)
        "CREATE TABLE IF NOT EXISTS app_settings (\n      key TEXT PRIMARY KEY,\n      value TEXT,\n      updated_at TEXT NOT NULL DEFAULT (datetime('now'))\n    )",
        // Sales Nav InMail gets its own daily budget — separate from daily_message_limit,
        // since InMail (non-connections) and regular messages (connections) were being
        // gated off the same counter, starving one whenever the other was busy.
        "ALTER TABLE accounts ADD COLUMN daily_inmail_limit INTEGER DEFAULT 15",
        // Sales Nav search: persistent cache of resolved filter values (typeahead
        // ids). Dedup on (filter_type, id) — LinkedIn ids are stable (e.g. Berlin's
        // geoUrn never changes), so once resolved a value is reused forever with no
        // further live typeahead calls. Lives here (not ee/) per the open-core rule:
        // all migrations stay in lib/db.ts. Consumed only by the ee/ search feature.
        "CREATE TABLE IF NOT EXISTS search_filter_cache (\n      id            TEXT NOT NULL,\n      filter_type   TEXT NOT NULL,\n      display_value TEXT NOT NULL,\n      headline      TEXT,\n      query         TEXT NOT NULL,\n      created_at    TEXT NOT NULL DEFAULT (datetime('now')),\n      PRIMARY KEY (filter_type, id)\n    )",
        "CREATE INDEX IF NOT EXISTS idx_sfc_type_query ON search_filter_cache(filter_type, query)",
        "CREATE INDEX IF NOT EXISTS idx_sfc_type_display ON search_filter_cache(filter_type, display_value)",
        "CREATE INDEX IF NOT EXISTS idx_logs_run_id ON logs(run_id)",
        "CREATE INDEX IF NOT EXISTS idx_logs_target_id ON logs(target_id)",
        "CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at)",
        "CREATE INDEX IF NOT EXISTS idx_run_profiles_run_id ON run_profiles(run_id)",
        "CREATE INDEX IF NOT EXISTS idx_run_profiles_target_id ON run_profiles(target_id)",
        "CREATE INDEX IF NOT EXISTS idx_runs_workflow_id ON runs(workflow_id)",
        "CREATE INDEX IF NOT EXISTS idx_runs_list_id ON runs(list_id)",
        // CSV import: lists can be flagged as linkedin- or email-only, so the runner/UI
        // can warn before enrolling a purpose-mismatched list into a campaign.
        "ALTER TABLE lists ADD COLUMN purpose TEXT",
        // Manual/CSV-only field — no automation reads or writes this, reference data only.
        "ALTER TABLE targets ADD COLUMN phone TEXT",
        "ALTER TABLE targets ADD COLUMN lead_status TEXT DEFAULT 'lead'",
        "ALTER TABLE workflows ADD COLUMN allow_cross_campaign_overlap INTEGER DEFAULT 0",
    ];
    for (var _i = 0, migrations_1 = migrations; _i < migrations_1.length; _i++) {
        var sql = migrations_1[_i];
        try {
            db.exec(sql);
        }
        catch ( /* column already exists */_a) { /* column already exists */ }
    }
    // Parallel tracks: assign email steps to email track, re-number step_order, backfill run_profile_tracks
    runParallelTracksMigration(db);
    // Drop deprecated run_profiles columns (state, current_step, etc.) — consumers now read track-runs
    dropDeprecatedRunProfileColumns(db);
    // Safely migrate workflow_steps CHECK constraint
    try {
        var tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='workflow_steps'").get();
        if (tableInfo && !tableInfo.sql.includes("'integration'")) {
            db.exec("PRAGMA foreign_keys = OFF;");
            var columnsQuery = db.prepare("PRAGMA table_info(workflow_steps)").all();
            var colNames = columnsQuery.map(function (c) { return c.name; });
            // We will recreate it dynamically
            var createSql = "CREATE TABLE workflow_steps_new (\n        id TEXT PRIMARY KEY,\n        workflow_id TEXT REFERENCES workflows(id) ON DELETE CASCADE,\n        step_order INTEGER NOT NULL,\n        step_type TEXT NOT NULL CHECK(step_type IN ('visit', 'connect', 'message', 'sales_inmail', 'delay', 'email', 'integration')),\n        template_id TEXT REFERENCES templates(id)";
            for (var _b = 0, columnsQuery_4 = columnsQuery; _b < columnsQuery_4.length; _b++) {
                var col = columnsQuery_4[_b];
                if (!['id', 'workflow_id', 'step_order', 'step_type', 'template_id'].includes(col.name)) {
                    createSql += ", ".concat(col.name, " ").concat(col.type);
                }
            }
            createSql += ");";
            db.exec(createSql);
            var colList = colNames.join(', ');
            db.exec("INSERT INTO workflow_steps_new (".concat(colList, ") SELECT ").concat(colList, " FROM workflow_steps;"));
            db.exec("DROP TABLE workflow_steps;");
            db.exec("ALTER TABLE workflow_steps_new RENAME TO workflow_steps;");
            db.exec("PRAGMA foreign_keys = ON;");
        }
    }
    catch (err) {
        console.error("Migration error:", err);
    }
    // Allow the 'sales_inmail' step_type (Sales Navigator InMail). Rebuilds the
    // table preserving EVERY current column (the historical rebuild above only
    // copied the original columns — do NOT reuse it). InMail reuses message_body
    // for the body and email_subject for the required subject.
    try {
        var ti = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='workflow_steps'").get();
        if (ti && !ti.sql.includes("'sales_inmail'")) {
            var cols = db.prepare("PRAGMA table_info(workflow_steps)").all().map(function (c) { return c.name; });
            var colList = cols.join(", ");
            db.exec("\n        PRAGMA foreign_keys = OFF;\n        CREATE TABLE workflow_steps_new (\n          id TEXT PRIMARY KEY,\n          workflow_id TEXT REFERENCES workflows(id) ON DELETE CASCADE,\n          step_order INTEGER NOT NULL,\n          step_type TEXT NOT NULL CHECK(step_type IN ('visit', 'connect', 'message', 'sales_inmail', 'delay', 'email')),\n          template_id TEXT REFERENCES templates(id),\n          delay_seconds INTEGER DEFAULT 0,\n          connect_note TEXT,\n          message_body TEXT,\n          email_subject TEXT,\n          email_body TEXT,\n          enabled INTEGER DEFAULT 1,\n          ai_enabled INTEGER DEFAULT 0,\n          ai_model TEXT,\n          ai_prompt TEXT,\n          ai_max_words INTEGER,\n          email_position INTEGER DEFAULT 1,\n          message_position INTEGER DEFAULT 1,\n          ai_language TEXT DEFAULT 'English',\n          track TEXT NOT NULL DEFAULT 'linkedin' CHECK(track IN ('linkedin', 'email')),\n          email_signature TEXT\n        );\n        INSERT INTO workflow_steps_new (".concat(colList, ") SELECT ").concat(colList, " FROM workflow_steps;\n        DROP TABLE workflow_steps;\n        ALTER TABLE workflow_steps_new RENAME TO workflow_steps;\n        PRAGMA foreign_keys = ON;\n      "));
        }
    }
    catch ( /* migration already done */_c) { /* migration already done */ }
    // CSV import: allow email-only targets (no LinkedIn URL). targets.linkedin_url was
    // NOT NULL UNIQUE from the base schema — rebuild to make it nullable (still UNIQUE,
    // SQLite allows multiple NULLs under UNIQUE) preserving EVERY current column, same
    // pattern as the sales_inmail rebuild above (do not reuse the older historical rebuilds
    // that only copied the original columns).
    try {
        var ti = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='targets'").get();
        if (ti && ti.sql.includes("linkedin_url TEXT NOT NULL")) {
            var cols = db.prepare("PRAGMA table_info(targets)").all();
            var colDefs = cols.map(function (c) {
                if (c.name === "linkedin_url")
                    return "linkedin_url TEXT UNIQUE";
                if (c.name === "id")
                    return "id TEXT PRIMARY KEY";
                var notnull = c.notnull ? " NOT NULL" : "";
                // Non-literal defaults (e.g. datetime('now')) must be parenthesized in SQLite DDL.
                var isLiteral = c.dflt_value === null || /^-?\d+(\.\d+)?$/.test(c.dflt_value) || /^'.*'$/.test(c.dflt_value);
                var dflt = c.dflt_value !== null ? " DEFAULT ".concat(isLiteral ? c.dflt_value : "(".concat(c.dflt_value, ")")) : "";
                return "".concat(c.name, " ").concat(c.type).concat(notnull).concat(dflt);
            });
            var colList = cols.map(function (c) { return c.name; }).join(", ");
            db.exec("\n        PRAGMA foreign_keys = OFF;\n        CREATE TABLE targets_new (\n          ".concat(colDefs.join(",\n          "), "\n        );\n        INSERT INTO targets_new (").concat(colList, ") SELECT ").concat(colList, " FROM targets;\n        DROP TABLE targets;\n        ALTER TABLE targets_new RENAME TO targets;\n        PRAGMA foreign_keys = ON;\n      "));
        }
    }
    catch ( /* migration already done */_d) { /* migration already done */ }
    // Backfill: move company_description and company_size from targets into companies
    try {
        db.exec("\n      UPDATE companies\n      SET\n        description = COALESCE(description, (\n          SELECT t.company_description FROM targets t\n          WHERE t.company_id = companies.id AND t.company_description IS NOT NULL\n          LIMIT 1\n        )),\n        employee_count = COALESCE(employee_count, (\n          SELECT t.company_size FROM targets t\n          WHERE t.company_id = companies.id AND t.company_size IS NOT NULL\n          LIMIT 1\n        ))\n      WHERE description IS NULL OR employee_count IS NULL\n    ");
    }
    catch ( /* ignore */_e) { /* ignore */ }
    // Backfill: for old records where linkedin_url is a Sales Nav URL, move it to sales_nav_url
    try {
        db.exec("\n      UPDATE targets\n      SET sales_nav_url = linkedin_url\n      WHERE linkedin_url LIKE '%/sales/lead/%' AND (sales_nav_url IS NULL OR sales_nav_url = '')\n    ");
    }
    catch ( /* ignore */_f) { /* ignore */ }
    // Create unique index on run_profiles if not already present (idempotent)
    try {
        db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_run_profiles_unique ON run_profiles(run_id, target_id);");
    }
    catch ( /* ignore */_g) { /* ignore */ }
    encryptLegacySecretsMigration(db);
}
// One-time (per-row) migration: encrypt any plaintext accounts.cookies_json,
// email_accounts.password/imap_password, integrations.api_key left over from before
// encryption-at-rest was added. isEncrypted() lets this run safely on every boot — already
//-encrypted rows (real "v1:" ciphertext) are skipped, so this is idempotent and cheap once
// migrated. See lib/crypto.ts for the format and lib/premium.ts-style boundary notes.
function encryptLegacySecretsMigration(db) {
    var accounts = db.prepare("SELECT id, cookies_json FROM accounts WHERE cookies_json IS NOT NULL").all();
    for (var _i = 0, accounts_1 = accounts; _i < accounts_1.length; _i++) {
        var row = accounts_1[_i];
        if ((0, crypto_2.isEncrypted)(row.cookies_json))
            continue;
        db.prepare("UPDATE accounts SET cookies_json = ? WHERE id = ?").run((0, crypto_2.encryptSecret)(row.cookies_json), row.id);
    }
    var emailAccounts = db
        .prepare("SELECT id, password, imap_password FROM email_accounts")
        .all();
    for (var _a = 0, emailAccounts_1 = emailAccounts; _a < emailAccounts_1.length; _a++) {
        var row = emailAccounts_1[_a];
        var needsPassword = !(0, crypto_2.isEncrypted)(row.password);
        var needsImapPassword = row.imap_password !== null && !(0, crypto_2.isEncrypted)(row.imap_password);
        if (!needsPassword && !needsImapPassword)
            continue;
        db.prepare("UPDATE email_accounts SET password = ?, imap_password = ? WHERE id = ?").run(needsPassword ? (0, crypto_2.encryptSecret)(row.password) : row.password, needsImapPassword ? (0, crypto_2.encryptSecret)(row.imap_password) : row.imap_password, row.id);
    }
    var integrations = db.prepare("SELECT key, api_key FROM integrations WHERE api_key IS NOT NULL").all();
    for (var _b = 0, integrations_1 = integrations; _b < integrations_1.length; _b++) {
        var row = integrations_1[_b];
        if ((0, crypto_2.isEncrypted)(row.api_key))
            continue;
        db.prepare("UPDATE integrations SET api_key = ? WHERE key = ?").run((0, crypto_2.encryptSecret)(row.api_key), row.key);
    }
}
function initDb(db) {
    db.exec("\n    CREATE TABLE IF NOT EXISTS accounts (\n      id TEXT PRIMARY KEY,\n      name TEXT NOT NULL,\n      email TEXT NOT NULL UNIQUE,\n      cookies_json TEXT,\n      is_authenticated INTEGER DEFAULT 0,\n      withdraw_invites_after_days INTEGER DEFAULT 14,\n      daily_connection_limit INTEGER DEFAULT 20,\n      daily_message_limit INTEGER DEFAULT 50,\n      daily_inmail_limit INTEGER DEFAULT 15,\n      active_hours_start INTEGER DEFAULT 9,\n      active_hours_end INTEGER DEFAULT 18,\n      timezone TEXT DEFAULT 'UTC',\n      working_days TEXT DEFAULT '1,2,3,4,5',\n      created_at TEXT DEFAULT (datetime('now'))\n    );\n\n    CREATE TABLE IF NOT EXISTS targets (\n      id TEXT PRIMARY KEY,\n      linkedin_url TEXT UNIQUE,\n      sales_nav_url TEXT,\n      first_name TEXT,\n      last_name TEXT,\n      full_name TEXT,\n      title TEXT,\n      company TEXT,\n      location TEXT,\n      profile_image_url TEXT,\n      degree INTEGER,\n      connection_requested_at TEXT,\n      connected_at TEXT,\n      message_sent_at TEXT,\n      last_replied_at TEXT,\n      linkedin_member_urn TEXT,\n      enriched_at TEXT,\n      created_at TEXT DEFAULT (datetime('now'))\n    );\n\n    CREATE TABLE IF NOT EXISTS lists (\n      id TEXT PRIMARY KEY,\n      name TEXT NOT NULL,\n      description TEXT,\n      sales_nav_url TEXT,\n      purpose TEXT CHECK(purpose IN ('linkedin', 'email')),\n      created_at TEXT DEFAULT (datetime('now'))\n    );\n\n    CREATE TABLE IF NOT EXISTS list_targets (\n      list_id TEXT REFERENCES lists(id) ON DELETE CASCADE,\n      target_id TEXT REFERENCES targets(id) ON DELETE CASCADE,\n      PRIMARY KEY (list_id, target_id)\n    );\n\n    CREATE TABLE IF NOT EXISTS templates (\n      id TEXT PRIMARY KEY,\n      name TEXT NOT NULL,\n      body TEXT NOT NULL,\n      created_at TEXT DEFAULT (datetime('now'))\n    );\n\n    CREATE TABLE IF NOT EXISTS workflows (\n      id TEXT PRIMARY KEY,\n      name TEXT NOT NULL,\n      description TEXT,\n      created_at TEXT DEFAULT (datetime('now'))\n    );\n\n    CREATE TABLE IF NOT EXISTS workflow_steps (\n      id TEXT PRIMARY KEY,\n      workflow_id TEXT REFERENCES workflows(id) ON DELETE CASCADE,\n      step_order INTEGER NOT NULL,\n      step_type TEXT NOT NULL CHECK(step_type IN ('visit', 'connect', 'message', 'delay', 'email', 'sales_inmail', 'integration', 'change_status')),\n      template_id TEXT REFERENCES templates(id),\n      delay_seconds INTEGER DEFAULT 0,\n      connect_note TEXT,\n      message_body TEXT,\n      enabled INTEGER DEFAULT 1,\n      config TEXT\n    );\n\n    CREATE TABLE IF NOT EXISTS workflow_step_templates (\n      step_id TEXT REFERENCES workflow_steps(id) ON DELETE CASCADE,\n      template_id TEXT REFERENCES templates(id) ON DELETE CASCADE,\n      PRIMARY KEY (step_id, template_id)\n    );\n\n    CREATE TABLE IF NOT EXISTS runs (\n      id TEXT PRIMARY KEY,\n      workflow_id TEXT REFERENCES workflows(id),\n      list_id TEXT REFERENCES lists(id),\n      account_id TEXT REFERENCES accounts(id),\n      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'paused', 'completed', 'failed')),\n      created_at TEXT DEFAULT (datetime('now')),\n      started_at TEXT,\n      completed_at TEXT,\n      runner_pid INTEGER\n    );\n\n    CREATE TABLE IF NOT EXISTS run_profiles (\n      id TEXT PRIMARY KEY,\n      run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,\n      target_id TEXT REFERENCES targets(id) ON DELETE CASCADE,\n      state TEXT DEFAULT 'pending' CHECK(state IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')),\n      current_step INTEGER DEFAULT 0,\n      last_step_at TEXT,\n      next_step_at TEXT,\n      error_message TEXT,\n      created_at TEXT DEFAULT (datetime('now')),\n      UNIQUE(run_id, target_id)\n    );\n\n    CREATE TABLE IF NOT EXISTS logs (\n      id TEXT PRIMARY KEY,\n      run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,\n      target_id TEXT REFERENCES targets(id) ON DELETE CASCADE,\n      level TEXT DEFAULT 'info' CHECK(level IN ('info', 'warn', 'error')),\n      message TEXT NOT NULL,\n      created_at TEXT DEFAULT (datetime('now'))\n    );\n\n    CREATE TABLE IF NOT EXISTS users (\n      id TEXT PRIMARY KEY,\n      email TEXT NOT NULL UNIQUE,\n      password_hash TEXT NOT NULL,\n      created_at TEXT DEFAULT (datetime('now'))\n    );\n\n    CREATE TABLE IF NOT EXISTS companies (\n      id TEXT PRIMARY KEY,\n      name TEXT NOT NULL,\n      domain TEXT,\n      industry TEXT,\n      location TEXT,\n      linkedin_url TEXT,\n      website TEXT,\n      notes TEXT,\n      created_at TEXT DEFAULT (datetime('now'))\n    );\n\n    CREATE TABLE IF NOT EXISTS integrations (\n      key TEXT PRIMARY KEY,\n      api_key TEXT,\n      created_at TEXT DEFAULT (datetime('now')),\n      updated_at TEXT DEFAULT (datetime('now'))\n    );\n\n    CREATE TABLE IF NOT EXISTS agent_config (\n      id INTEGER PRIMARY KEY DEFAULT 1,\n      system_prompt TEXT,\n      user_prompt TEXT,\n      email_examples TEXT,\n      linkedin_examples TEXT,\n      updated_at TEXT DEFAULT (datetime('now'))\n    );\n\n    CREATE TABLE IF NOT EXISTS agent_sessions (\n      id TEXT PRIMARY KEY,\n      run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,\n      target_id TEXT REFERENCES targets(id) ON DELETE CASCADE,\n      step_id TEXT,\n      model TEXT,\n      input_tokens INTEGER,\n      output_tokens INTEGER,\n      cost_usd REAL,\n      prompt TEXT,\n      generated_text TEXT,\n      created_at TEXT DEFAULT (datetime('now'))\n    );\n\n    -- Hosted MCP OAuth 2.1 server: clients (DCR), single-use auth codes, access/refresh tokens.\n    -- Tokens/codes are stored only as sha256 hashes. Reuses NEXTAUTH user identity.\n    CREATE TABLE IF NOT EXISTS oauth_clients (\n      client_id TEXT PRIMARY KEY,\n      client_name TEXT,\n      redirect_uris TEXT NOT NULL,\n      created_at TEXT DEFAULT (datetime('now'))\n    );\n\n    CREATE TABLE IF NOT EXISTS oauth_auth_codes (\n      code_hash TEXT PRIMARY KEY,\n      client_id TEXT NOT NULL,\n      user_id TEXT NOT NULL,\n      redirect_uri TEXT NOT NULL,\n      code_challenge TEXT NOT NULL,\n      scope TEXT,\n      expires_at TEXT NOT NULL,\n      created_at TEXT DEFAULT (datetime('now'))\n    );\n\n    CREATE TABLE IF NOT EXISTS oauth_tokens (\n      id TEXT PRIMARY KEY,\n      access_hash TEXT NOT NULL UNIQUE,\n      refresh_hash TEXT UNIQUE,\n      client_id TEXT NOT NULL,\n      user_id TEXT NOT NULL,\n      scope TEXT,\n      expires_at TEXT NOT NULL,\n      created_at TEXT DEFAULT (datetime('now'))\n    );\n\n    CREATE TABLE IF NOT EXISTS email_accounts (\n      id TEXT PRIMARY KEY,\n      name TEXT NOT NULL,\n      from_email TEXT NOT NULL,\n      from_name TEXT,\n      smtp_host TEXT NOT NULL,\n      smtp_port INTEGER DEFAULT 587,\n      smtp_secure INTEGER DEFAULT 0,\n      imap_host TEXT,\n      imap_port INTEGER DEFAULT 993,\n      username TEXT NOT NULL,\n      password TEXT NOT NULL,\n      daily_email_limit INTEGER DEFAULT 50,\n      active_hours_start INTEGER DEFAULT 9,\n      active_hours_end INTEGER DEFAULT 18,\n      timezone TEXT DEFAULT 'UTC',\n      working_days TEXT DEFAULT '1,2,3,4,5',\n      is_verified INTEGER DEFAULT 0,\n      inbox_synced_at TEXT,\n      inbox_last_uid INTEGER,\n      inbox_uidvalidity INTEGER,\n      created_at TEXT DEFAULT (datetime('now'))\n    );\n  ");
}
