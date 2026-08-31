"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = log;
exports.ensureGlobalRunnerStarted = ensureGlobalRunnerStarted;
exports.startRun = startRun;
var inbox_observer_1 = require("./inbox-observer");
var inbox_sync_1 = require("./inbox-sync");
var db_1 = require("@/lib/db");
var crypto_1 = require("crypto");
var session_1 = require("@/lib/linkedin/session");
var circuit_breaker_1 = require("./circuit-breaker");
var visit_1 = require("@/lib/linkedin/visit");
var connect_1 = require("@/lib/linkedin/connect");
var message_1 = require("@/lib/linkedin/message");
var sync_accepted_1 = require("@/lib/linkedin/sync-accepted");
var withdraw_1 = require("@/lib/linkedin/withdraw");
var sender_1 = require("@/lib/email/sender");
var inbox_1 = require("@/lib/email/inbox");
var enrich_1 = require("@/lib/linkedin/enrich");
var apollo_1 = require("@/lib/apollo");
var premium_1 = require("@/lib/premium");
var crypto_2 = require("@/lib/crypto");
// Minimum gap between Sales Nav profile enrichment calls per account (ms)
var SALES_NAV_ENRICH_MIN_GAP_MS = 5 * 60 * 1000;
// Per-account timestamp of last ensureSalesNavEnriched execution
var lastSalesNavEnrichAt = {};
var lastLinkedinSync = new Map();
var activeLinkedinSyncs = new Set();
var withdrawSyncs = new Map();
// Accounts that reported "No InMail credits left" today (Jul 2026 incident — LinkedIn's
// own credit balance, distinct from daily_inmail_limit; without this, a depleted account
// re-attempted InMail on every queued lead, each burning a ~30-50s Sales Nav page load for
// nothing). Keyed by accountId -> the date (YYYY-MM-DD, local) it was detected exhausted.
// In-memory only — worst case after a restart is one wasted attempt before re-detecting.
var inmailCreditsExhaustedOn = {};
function todayLocalDate() { return new Date().toISOString().slice(0, 10); }
function inmailCreditsExhaustedToday(accountId) {
    return inmailCreditsExhaustedOn[accountId] === todayLocalDate();
}
// Initial wait before first acceptance check (6h)
var CONNECTION_RECHECK_HOURS = 6;
// Max days to wait for acceptance before giving up
var CONNECTION_MAX_WAIT_DAYS = 7;
// Delay between profiles (seconds)
var PROFILE_DELAY_MIN = 8;
var PROFILE_DELAY_MAX = 20;
// Poll interval (ms)
var POLL_INTERVAL_MS = 30000;
function effectiveEmailLimit(account) {
    if (!account.ramp_up_enabled || !account.ramp_start_date)
        return account.daily_email_limit;
    var daysActive = Math.max(1, Math.floor((Date.now() - new Date(account.ramp_start_date).getTime()) / 86400000) + 1);
    var ramped = daysActive * 2;
    return Math.min(account.daily_email_limit, ramped);
}
function getLocalParts(tz, date) {
    var _a;
    if (date === void 0) { date = new Date(); }
    var safeZone = (function () { try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return tz;
    }
    catch (_a) {
        return "UTC";
    } })();
    var parts = new Intl.DateTimeFormat("en-US", {
        timeZone: safeZone,
        hour: "numeric", minute: "numeric", weekday: "short", hour12: false,
    }).formatToParts(date);
    var get = function (t) { var _a, _b; return (_b = (_a = parts.find(function (p) { return p.type === t; })) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : ""; };
    var hour = parseInt(get("hour"), 10) % 24;
    var minute = parseInt(get("minute"), 10);
    var weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    return { hour: hour, minute: minute, isoWeekday: (_a = weekdayMap[get("weekday")]) !== null && _a !== void 0 ? _a : 1 };
}
function isWithinSchedule(account) {
    var _a, _b;
    var _c = getLocalParts(account.timezone || "UTC"), hour = _c.hour, minute = _c.minute, isoWeekday = _c.isoWeekday;
    var allowedDays = (account.working_days || "1,2,3,4,5").split(",").map(Number);
    if (!allowedDays.includes(isoWeekday))
        return false;
    var frac = hour + minute / 60;
    return frac >= ((_a = account.active_hours_start) !== null && _a !== void 0 ? _a : 9) && frac < ((_b = account.active_hours_end) !== null && _b !== void 0 ? _b : 18);
}
function randomSlotInActiveWindow(account, targetDate) {
    var _a, _b;
    var start = (_a = account.active_hours_start) !== null && _a !== void 0 ? _a : 9;
    var end = (_b = account.active_hours_end) !== null && _b !== void 0 ? _b : 18;
    var base = targetDate ? new Date(targetDate) : new Date();
    var startMs = new Date(base.getFullYear(), base.getMonth(), base.getDate(), start, 0, 0).getTime();
    var endMs = new Date(base.getFullYear(), base.getMonth(), base.getDate(), end, 0, 0).getTime();
    return new Date(startMs + Math.random() * (endMs - startMs)).toISOString();
}
function rescheduleToTomorrow(account) {
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return randomSlotInActiveWindow(account, tomorrow);
}
function nextScheduledSlot(account) {
    var _a;
    var tz = account.timezone || "UTC";
    var allowedDays = (account.working_days || "1,2,3,4,5").split(",").map(Number);
    var end = (_a = account.active_hours_end) !== null && _a !== void 0 ? _a : 18;
    var _b = getLocalParts(tz), nowHour = _b.hour, nowMin = _b.minute, nowDay = _b.isoWeekday;
    var nowFrac = nowHour + nowMin / 60;
    if (allowedDays.includes(nowDay) && nowFrac < end - 0.25) {
        var remaining = (end - nowFrac) * 3600000;
        return new Date(Date.now() + Math.random() * remaining).toISOString();
    }
    var candidate = new Date();
    for (var i = 1; i <= 14; i++) {
        candidate.setDate(candidate.getDate() + 1);
        var isoWeekday = getLocalParts(tz, candidate).isoWeekday;
        if (allowedDays.includes(isoWeekday))
            return randomSlotInActiveWindow(account, candidate);
    }
    return new Date(Date.now() + 86400000).toISOString();
}
// ─── helpers ────────────────────────────────────────────────────────────────
function log(db, runId, targetId, level, message) {
    db.prepare("INSERT INTO logs (id, run_id, target_id, level, message) VALUES (?, ?, ?, ?, ?)").run((0, crypto_1.randomUUID)(), runId, targetId, level, message);
    console.log("[runner] [".concat(level, "] run=").concat(runId, " target=").concat(targetId !== null && targetId !== void 0 ? targetId : "-", " ").concat(message));
}
function renderTemplate(body, target) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    return body
        .replace(/\{\{first_name\}\}/gi, (_c = (_a = target.first_name) !== null && _a !== void 0 ? _a : (_b = target.full_name) === null || _b === void 0 ? void 0 : _b.split(" ")[0]) !== null && _c !== void 0 ? _c : "")
        .replace(/\{\{last_name\}\}/gi, (_f = (_d = target.last_name) !== null && _d !== void 0 ? _d : (_e = target.full_name) === null || _e === void 0 ? void 0 : _e.split(" ").slice(1).join(" ")) !== null && _f !== void 0 ? _f : "")
        .replace(/\{\{full_name\}\}/gi, (_g = target.full_name) !== null && _g !== void 0 ? _g : "")
        .replace(/\{\{company\}\}/gi, (_h = target.company) !== null && _h !== void 0 ? _h : "")
        .replace(/\{\{title\}\}/gi, (_j = target.title) !== null && _j !== void 0 ? _j : "")
        .replace(/\{\{location\}\}/gi, (_k = target.location) !== null && _k !== void 0 ? _k : "")
        .trim();
}
function sleep(ms) { return new Promise(function (r) { return setTimeout(r, ms); }); }
function randomDelay(minSec, maxSec) { return sleep((minSec + Math.random() * (maxSec - minSec)) * 1000); }
function nowIso() { return new Date().toISOString(); }
function addHours(h) { return new Date(Date.now() + h * 3600000).toISOString(); }
function hoursSince(isoStr) { return (Date.now() - new Date(isoStr).getTime()) / 3600000; }
// ─── TrackRun verb layer ─────────────────────────────────────────────────────
// These are the only functions that write to run_profile_tracks rows.
function trAdvance(db, tr, steps) {
    var nextIndex = tr.current_step + 1;
    if (nextIndex >= steps.length) {
        db.prepare("UPDATE run_profile_tracks SET state = 'completed', current_step = ?, last_step_at = datetime('now'), next_step_at = NULL WHERE id = ?").run(nextIndex, tr.id);
    }
    else {
        var nextStep = steps[nextIndex];
        var nextAt = nextStep.delay_seconds > 0 ? new Date(Date.now() + nextStep.delay_seconds * 1000).toISOString() : null;
        db.prepare("UPDATE run_profile_tracks SET current_step = ?, last_step_at = datetime('now'), next_step_at = ? WHERE id = ?").run(nextIndex, nextAt, tr.id);
    }
}
function trWait(db, tr, hours) {
    db.prepare("UPDATE run_profile_tracks SET next_step_at = ? WHERE id = ?").run(addHours(hours), tr.id);
}
function trReschedule(db, tr, isoTimestamp) {
    db.prepare("UPDATE run_profile_tracks SET next_step_at = ? WHERE id = ?").run(isoTimestamp, tr.id);
}
function trSkip(db, tr, reason) {
    db.prepare("UPDATE run_profile_tracks SET state = 'skipped', error_message = ? WHERE id = ?").run(reason, tr.id);
}
function trFail(db, tr, reason) {
    db.prepare("UPDATE run_profile_tracks SET state = 'failed', error_message = ? WHERE id = ?").run(reason, tr.id);
}
function trRecordContext(db, tr, ctx) {
    var _a, _b, _c;
    if (ctx.linkedinMessage !== undefined) {
        db.prepare("UPDATE run_profile_tracks SET last_linkedin_message = ? WHERE id = ?").run(ctx.linkedinMessage, tr.id);
    }
    if (ctx.emailSubject !== undefined || ctx.emailBody !== undefined || ctx.emailMessageId !== undefined) {
        db.prepare("UPDATE run_profile_tracks SET last_email_subject = COALESCE(?, last_email_subject), last_email_body = COALESCE(?, last_email_body), last_email_message_id = COALESCE(?, last_email_message_id) WHERE id = ?")
            .run((_a = ctx.emailSubject) !== null && _a !== void 0 ? _a : null, (_b = ctx.emailBody) !== null && _b !== void 0 ? _b : null, (_c = ctx.emailMessageId) !== null && _c !== void 0 ? _c : null, tr.id);
    }
}
// ─── enforceSchedule helper ──────────────────────────────────────────────────
// Returns true if the step may proceed. Returns false and reschedules if outside the window.
function enforceSchedule(db, tr, runId, targetId, name, schedule) {
    if (isWithinSchedule(schedule))
        return true;
    var nextSlot = nextScheduledSlot(schedule);
    log(db, runId, targetId, "info", "Outside working schedule \u2014 rescheduling ".concat(name, " to ").concat(nextSlot));
    trReschedule(db, tr, nextSlot);
    return false;
}
// ─── URL resolution ──────────────────────────────────────────────────────────
function resolveLinkedinUrl(db, target, accountId) {
    return __awaiter(this, void 0, void 0, function () {
        var salesNavUrl, leadMatch, page, profileJson, p, flagshipUrl, linkedinUrl, rawPositions, positions, rawSkills, skills;
        var _this = this;
        var _a, _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    if ((_a = target.linkedin_url) === null || _a === void 0 ? void 0 : _a.includes("/in/"))
                        return [2 /*return*/, target.linkedin_url];
                    salesNavUrl = (_b = target.sales_nav_url) !== null && _b !== void 0 ? _b : target.linkedin_url;
                    if (!salesNavUrl)
                        throw new Error("".concat((_c = target.full_name) !== null && _c !== void 0 ? _c : target.id, " has no Sales Nav URL to resolve from"));
                    leadMatch = salesNavUrl.match(/\/sales\/lead\/(.+)/);
                    if (!leadMatch)
                        throw new Error("".concat((_d = target.full_name) !== null && _d !== void 0 ? _d : target.id, " has no Sales Nav lead URL \u2014 cannot resolve LinkedIn URL"));
                    return [4 /*yield*/, (0, session_1.getSessionPage)(accountId)];
                case 1:
                    page = _f.sent();
                    profileJson = null;
                    _f.label = 2;
                case 2:
                    _f.trys.push([2, , 5, 7]);
                    page.on("response", function (response) { return __awaiter(_this, void 0, void 0, function () {
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    if (!(response.url().includes("salesApiProfiles/") && response.status() === 200 && !profileJson)) return [3 /*break*/, 4];
                                    _b.label = 1;
                                case 1:
                                    _b.trys.push([1, 3, , 4]);
                                    return [4 /*yield*/, response.json()];
                                case 2:
                                    profileJson = (_b.sent());
                                    return [3 /*break*/, 4];
                                case 3:
                                    _a = _b.sent();
                                    return [3 /*break*/, 4];
                                case 4: return [2 /*return*/];
                            }
                        });
                    }); });
                    return [4 /*yield*/, page.goto("https://www.linkedin.com/sales/lead/".concat(leadMatch[1]), { waitUntil: "domcontentloaded", timeout: 30000 })];
                case 3:
                    _f.sent();
                    return [4 /*yield*/, page.waitForTimeout(10000)];
                case 4:
                    _f.sent();
                    return [3 /*break*/, 7];
                case 5: return [4 /*yield*/, page.close()];
                case 6:
                    _f.sent();
                    return [7 /*endfinally*/];
                case 7:
                    p = profileJson;
                    flagshipUrl = typeof (p === null || p === void 0 ? void 0 : p.flagshipProfileUrl) === "string" ? p.flagshipProfileUrl : null;
                    if (!flagshipUrl)
                        throw new Error("Could not resolve LinkedIn URL for ".concat((_e = target.full_name) !== null && _e !== void 0 ? _e : target.id));
                    linkedinUrl = flagshipUrl.endsWith("/") ? flagshipUrl : flagshipUrl + "/";
                    rawPositions = Array.isArray(p === null || p === void 0 ? void 0 : p.positions) ? p.positions : [];
                    positions = rawPositions.map(function (pos) { return ({
                        title: typeof pos.title === "string" ? pos.title : "",
                        companyName: typeof pos.companyName === "string" ? pos.companyName : "",
                        current: pos.current === true,
                        startedOn: pos.startedOn,
                        endedOn: pos.endedOn,
                        description: typeof pos.description === "string" ? pos.description : undefined,
                    }); });
                    rawSkills = Array.isArray(p === null || p === void 0 ? void 0 : p.skills) ? p.skills : [];
                    skills = rawSkills.map(function (s) { return (typeof s.name === "string" ? s.name : ""); }).filter(Boolean);
                    db.prepare("\n    UPDATE targets SET\n      linkedin_url         = ?,\n      linkedin_member_urn  = COALESCE(linkedin_member_urn, ?),\n      headline             = COALESCE(headline, ?),\n      summary              = COALESCE(summary, ?),\n      positions_json       = COALESCE(positions_json, ?),\n      skills_json          = CASE WHEN skills_json IS NULL AND ? IS NOT NULL THEN ? ELSE skills_json END,\n      enriched_profile_at  = COALESCE(enriched_profile_at, datetime('now'))\n    WHERE id = ?\n  ").run(linkedinUrl, typeof (p === null || p === void 0 ? void 0 : p.objectUrn) === "string" ? p.objectUrn : null, typeof (p === null || p === void 0 ? void 0 : p.headline) === "string" ? p.headline : null, typeof (p === null || p === void 0 ? void 0 : p.summary) === "string" ? p.summary : null, positions.length > 0 ? JSON.stringify(positions) : null, skills.length > 0 ? "1" : null, skills.length > 0 ? JSON.stringify(skills) : null, target.id);
                    return [2 /*return*/, linkedinUrl];
            }
        });
    });
}
function getLinkedinUrl(db, target, accountId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            if ((_a = target.linkedin_url) === null || _a === void 0 ? void 0 : _a.includes("/in/"))
                return [2 /*return*/, target.linkedin_url];
            return [2 /*return*/, resolveLinkedinUrl(db, target, accountId)];
        });
    });
}
// ─── pre-action enrichment ───────────────────────────────────────────────────
function ensureSalesNavEnriched(db, target, accountId) {
    return __awaiter(this, void 0, void 0, function () {
        var fresh, last, ctx, e_1;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    fresh = db.prepare("SELECT enriched_profile_at, apollo_enriched_at, sales_nav_url, full_name FROM targets WHERE id = ?").get(target.id);
                    if (!fresh || fresh.enriched_profile_at || fresh.apollo_enriched_at || !fresh.sales_nav_url)
                        return [2 /*return*/];
                    last = (_a = lastSalesNavEnrichAt[accountId]) !== null && _a !== void 0 ? _a : 0;
                    if (Date.now() - last < SALES_NAV_ENRICH_MIN_GAP_MS)
                        return [2 /*return*/];
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 4, , 5]);
                    lastSalesNavEnrichAt[accountId] = Date.now();
                    return [4 /*yield*/, (0, session_1.getSessionContext)(accountId)];
                case 2:
                    ctx = _e.sent();
                    return [4 /*yield*/, (0, enrich_1.enrichProfile)(ctx, { id: target.id, sales_nav_url: fresh.sales_nav_url, full_name: (_c = (_b = fresh.full_name) !== null && _b !== void 0 ? _b : target.full_name) !== null && _c !== void 0 ? _c : target.id })];
                case 3:
                    _e.sent();
                    return [3 /*break*/, 5];
                case 4:
                    e_1 = _e.sent();
                    console.warn("[runner] Sales Nav enrichment failed for ".concat((_d = target.full_name) !== null && _d !== void 0 ? _d : target.id, ":"), e_1 instanceof Error ? e_1.message : e_1);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function ensureApolloEnriched(db, target, runId) {
    return __awaiter(this, void 0, void 0, function () {
        var fresh, apolloUrl, integration, result, companyId, domain, existing, org, e_2;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14;
        return __generator(this, function (_15) {
            switch (_15.label) {
                case 0:
                    fresh = db.prepare("SELECT apollo_enriched_at, email, linkedin_url, sales_nav_url FROM targets WHERE id = ?").get(target.id);
                    if (!fresh || fresh.apollo_enriched_at || fresh.email)
                        return [2 /*return*/];
                    apolloUrl = ((_a = fresh.linkedin_url) === null || _a === void 0 ? void 0 : _a.includes("/in/")) ? fresh.linkedin_url : fresh.sales_nav_url;
                    if (!apolloUrl)
                        return [2 /*return*/];
                    integration = db.prepare("SELECT api_key FROM integrations WHERE key = 'apollo'").get();
                    if (!(integration === null || integration === void 0 ? void 0 : integration.api_key))
                        return [2 /*return*/];
                    _15.label = 1;
                case 1:
                    _15.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, apollo_1.matchPerson)(apolloUrl, (0, crypto_2.decryptSecret)(integration.api_key))];
                case 2:
                    result = _15.sent();
                    if (!result) {
                        db.prepare("UPDATE targets SET apollo_enriched_at = datetime('now') WHERE id = ?").run(target.id);
                        return [2 /*return*/];
                    }
                    companyId = null;
                    if ((_b = result.organization) === null || _b === void 0 ? void 0 : _b.domain) {
                        domain = result.organization.domain.replace(/^www\./, "").toLowerCase();
                        existing = db.prepare("SELECT id FROM companies WHERE domain = ?").get(domain);
                        org = result.organization;
                        if (existing) {
                            companyId = existing.id;
                            db.prepare("\n          UPDATE companies SET\n            industry = COALESCE(industry, ?), location = COALESCE(location, ?),\n            linkedin_url = COALESCE(linkedin_url, ?), website = COALESCE(website, ?),\n            founded_year = COALESCE(founded_year, ?), logo_url = COALESCE(logo_url, ?),\n            phone = COALESCE(phone, ?), annual_revenue = COALESCE(annual_revenue, ?),\n            technology_names = COALESCE(technology_names, ?), keywords = COALESCE(keywords, ?),\n            city = COALESCE(city, ?), country = COALESCE(country, ?),\n            description = COALESCE(description, ?), employee_count = COALESCE(employee_count, ?)\n          WHERE id = ?\n        ").run((_c = org.industry) !== null && _c !== void 0 ? _c : null, (_d = org.location) !== null && _d !== void 0 ? _d : null, (_e = org.linkedin_url) !== null && _e !== void 0 ? _e : null, (_f = org.website_url) !== null && _f !== void 0 ? _f : null, (_g = org.founded_year) !== null && _g !== void 0 ? _g : null, (_h = org.logo_url) !== null && _h !== void 0 ? _h : null, (_j = org.phone) !== null && _j !== void 0 ? _j : null, (_k = org.annual_revenue_printed) !== null && _k !== void 0 ? _k : null, org.technology_names ? JSON.stringify(org.technology_names) : null, org.keywords ? JSON.stringify(org.keywords) : null, (_l = org.city) !== null && _l !== void 0 ? _l : null, (_m = org.country) !== null && _m !== void 0 ? _m : null, (_o = org.short_description) !== null && _o !== void 0 ? _o : null, (_p = org.estimated_num_employees) !== null && _p !== void 0 ? _p : null, existing.id);
                        }
                        else {
                            companyId = (0, crypto_1.randomUUID)();
                            db.prepare("\n          INSERT INTO companies (id, name, domain, industry, location, linkedin_url, website, founded_year, logo_url, phone, annual_revenue, technology_names, keywords, city, country, description, employee_count)\n          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n        ").run(companyId, (_q = org.name) !== null && _q !== void 0 ? _q : "", domain, (_r = org.industry) !== null && _r !== void 0 ? _r : null, (_s = org.location) !== null && _s !== void 0 ? _s : null, (_t = org.linkedin_url) !== null && _t !== void 0 ? _t : null, (_u = org.website_url) !== null && _u !== void 0 ? _u : null, (_v = org.founded_year) !== null && _v !== void 0 ? _v : null, (_w = org.logo_url) !== null && _w !== void 0 ? _w : null, (_x = org.phone) !== null && _x !== void 0 ? _x : null, (_y = org.annual_revenue_printed) !== null && _y !== void 0 ? _y : null, org.technology_names ? JSON.stringify(org.technology_names) : null, org.keywords ? JSON.stringify(org.keywords) : null, (_z = org.city) !== null && _z !== void 0 ? _z : null, (_0 = org.country) !== null && _0 !== void 0 ? _0 : null, (_1 = org.short_description) !== null && _1 !== void 0 ? _1 : null, (_2 = org.estimated_num_employees) !== null && _2 !== void 0 ? _2 : null);
                        }
                    }
                    db.prepare("\n      UPDATE targets SET\n        apollo_id = ?, seniority = ?, apollo_functions = ?, apollo_departments = ?,\n        email = COALESCE(email, ?), email_status = COALESCE(email_status, ?),\n        email_domain_catchall = ?,\n        city = COALESCE(city, ?), country = COALESCE(country, ?),\n        time_zone = COALESCE(time_zone, ?),\n        headline = COALESCE(headline, ?),\n        positions_json = COALESCE(positions_json, ?),\n        company_id = COALESCE(company_id, ?),\n        linkedin_url = COALESCE(linkedin_url, ?),\n        apollo_enriched_at = datetime('now')\n      WHERE id = ?\n    ").run(result.apollo_id, (_3 = result.seniority) !== null && _3 !== void 0 ? _3 : null, result.functions ? JSON.stringify(result.functions) : null, result.departments ? JSON.stringify(result.departments) : null, (_4 = result.email) !== null && _4 !== void 0 ? _4 : null, (_5 = result.email_status) !== null && _5 !== void 0 ? _5 : null, result.email_domain_catchall ? 1 : 0, (_6 = result.city) !== null && _6 !== void 0 ? _6 : null, (_7 = result.country) !== null && _7 !== void 0 ? _7 : null, (_8 = result.time_zone) !== null && _8 !== void 0 ? _8 : null, (_9 = result.headline) !== null && _9 !== void 0 ? _9 : null, (_10 = result.positions_json) !== null && _10 !== void 0 ? _10 : null, companyId, (_11 = result.linkedin_url) !== null && _11 !== void 0 ? _11 : null, target.id);
                    console.log("[runner] Apollo enriched ".concat((_12 = target.full_name) !== null && _12 !== void 0 ? _12 : target.id, " \u2014 email: ").concat((_13 = result.email) !== null && _13 !== void 0 ? _13 : "not found"));
                    return [3 /*break*/, 4];
                case 3:
                    e_2 = _15.sent();
                    console.warn("[runner] Apollo enrichment failed for ".concat((_14 = target.full_name) !== null && _14 !== void 0 ? _14 : target.id, ":"), e_2 instanceof Error ? e_2.message : e_2);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ─── step execution ──────────────────────────────────────────────────────────
function executeStep(db, runId, tr, target, steps, accountId, accountLimits, emailAccountId, emailAccountLimits, campaignPrompt) {
    return __awaiter(this, void 0, void 0, function () {
        var stepIndex, replyCheck, channel, step, name, linkedinUrl, page, visitResult, e_3, freshTarget, hoursSinceRequest, linkedinUrl, page, e_4, freshTarget, requested, messageText, integration, apiKey, agentCfgForMsg, resolvedMsgModel, contactData, msgPosition, previousMessageContext, result, multiTemplateIds, randomId, tmpl, tmpl, messageLinkedinUrl, page, result, err_1, freshTarget, inmailBody, inmailSubject, integration, apiKey, agentCfgForMsg, resolvedMsgModel, contactData, msgPosition, previousMessageContext, result, multiTemplateIds, randomId, tmpl, tmpl, page, freshTarget, company, emailSubject, emailBody, integration, apiKey, agentCfgForEmail, resolvedEmailModel, contactData, emailPosition, followupContext, result, emailAccount, sentTodayActual, hardLimit, sig, finalEmailBody, messageId, err_2, msg, slot;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
        return __generator(this, function (_x) {
            switch (_x.label) {
                case 0:
                    stepIndex = tr.current_step;
                    if (stepIndex >= steps.length) {
                        db.prepare("UPDATE run_profile_tracks SET state = 'completed', last_step_at = datetime('now') WHERE id = ?").run(tr.id);
                        return [2 /*return*/];
                    }
                    replyCheck = db.prepare("SELECT last_replied_at, email_replied_at FROM targets WHERE id = ?").get(target.id);
                    if ((replyCheck === null || replyCheck === void 0 ? void 0 : replyCheck.last_replied_at) || (replyCheck === null || replyCheck === void 0 ? void 0 : replyCheck.email_replied_at)) {
                        channel = replyCheck.email_replied_at ? "email" : "LinkedIn";
                        log(db, runId, target.id, "info", "".concat((_a = target.full_name) !== null && _a !== void 0 ? _a : target.linkedin_url, " replied via ").concat(channel, " \u2014 unenrolling from workflow"));
                        db.prepare("UPDATE run_profile_tracks SET state = 'skipped', error_message = 'Lead replied' WHERE run_profile_id = ? AND state NOT IN ('completed', 'failed', 'skipped')").run(tr.run_profile_id);
                        return [2 /*return*/];
                    }
                    step = steps[stepIndex];
                    name = (_b = target.full_name) !== null && _b !== void 0 ? _b : target.linkedin_url;
                    _x.label = 1;
                case 1:
                    _x.trys.push([1, 56, , 57]);
                    if (step.step_type === "delay") {
                        trAdvance(db, tr, steps);
                        log(db, runId, target.id, "info", "Delay step passed for ".concat(name));
                        return [2 /*return*/];
                    }
                    if (!(step.step_type === "visit")) return [3 /*break*/, 11];
                    db.prepare("UPDATE run_profile_tracks SET last_step_at = datetime('now') WHERE id = ?").run(tr.id);
                    log(db, runId, target.id, "info", "Visiting ".concat(name));
                    return [4 /*yield*/, getLinkedinUrl(db, target, accountId)];
                case 2:
                    linkedinUrl = _x.sent();
                    return [4 /*yield*/, (0, session_1.getSessionPage)(accountId)];
                case 3:
                    page = _x.sent();
                    visitResult = void 0;
                    _x.label = 4;
                case 4:
                    _x.trys.push([4, 6, 7, 9]);
                    return [4 /*yield*/, (0, visit_1.visitProfile)(page, linkedinUrl)];
                case 5:
                    visitResult = _x.sent();
                    (0, circuit_breaker_1.recordSuccess)('visit');
                    return [3 /*break*/, 9];
                case 6:
                    e_3 = _x.sent();
                    (0, circuit_breaker_1.recordFailure)('visit', e_3.message);
                    throw e_3;
                case 7: return [4 /*yield*/, page.close()];
                case 8:
                    _x.sent();
                    return [7 /*endfinally*/];
                case 9: return [4 /*yield*/, (0, session_1.saveSessionState)(accountId)];
                case 10:
                    _x.sent();
                    if (visitResult.isFirstDegree && target.degree !== 1) {
                        db.prepare("UPDATE targets SET degree = 1, connected_at = COALESCE(connected_at, ?) WHERE id = ?").run(nowIso(), target.id);
                        log(db, runId, target.id, "info", "".concat(name, " already 1st-degree \u2014 backfilled connection status"));
                    }
                    if (visitResult.messagingUrn) {
                        db.prepare("UPDATE targets SET messaging_urn = COALESCE(messaging_urn, ?) WHERE id = ?").run(visitResult.messagingUrn, target.id);
                    }
                    trAdvance(db, tr, steps);
                    log(db, runId, target.id, "info", "Visited ".concat(name));
                    return [3 /*break*/, 55];
                case 11:
                    if (!(step.step_type === "connect")) return [3 /*break*/, 21];
                    if (!enforceSchedule(db, tr, runId, target.id, name, accountLimits))
                        return [2 /*return*/];
                    freshTarget = db.prepare("SELECT * FROM targets WHERE id = ?").get(target.id);
                    if (freshTarget.degree === 1) {
                        if (!freshTarget.connected_at)
                            db.prepare("UPDATE targets SET connected_at = ? WHERE id = ?").run(nowIso(), target.id);
                        log(db, runId, target.id, "info", "".concat(name, " already connected \u2014 skipping connect step"));
                        trAdvance(db, tr, steps);
                        return [2 /*return*/];
                    }
                    if (freshTarget.connection_requested_at) {
                        hoursSinceRequest = hoursSince(freshTarget.connection_requested_at);
                        if (hoursSinceRequest / 24 > CONNECTION_MAX_WAIT_DAYS) {
                            log(db, runId, target.id, "warn", "".concat(name, " did not accept after ").concat(CONNECTION_MAX_WAIT_DAYS, " days \u2014 skipping"));
                            trSkip(db, tr, "Did not accept connection after ".concat(CONNECTION_MAX_WAIT_DAYS, " days"));
                            return [2 /*return*/];
                        }
                        // Acceptance is detected by the daily sync-accepted job (scrolls invitation manager).
                        // Runner just re-checks degree from DB — no per-profile page visits needed.
                        log(db, runId, target.id, "info", "".concat(name, " not yet accepted \u2014 rechecking in ").concat(CONNECTION_RECHECK_HOURS, "h"));
                        trWait(db, tr, CONNECTION_RECHECK_HOURS);
                        return [2 /*return*/];
                    }
                    db.prepare("UPDATE run_profile_tracks SET last_step_at = datetime('now') WHERE id = ?").run(tr.id);
                    log(db, runId, target.id, "info", "Sending connection request to ".concat(name));
                    return [4 /*yield*/, getLinkedinUrl(db, target, accountId)];
                case 12:
                    linkedinUrl = _x.sent();
                    return [4 /*yield*/, (0, session_1.getSessionPage)(accountId)];
                case 13:
                    page = _x.sent();
                    _x.label = 14;
                case 14:
                    _x.trys.push([14, 16, 17, 19]);
                    return [4 /*yield*/, (0, connect_1.sendConnectionRequest)(page, linkedinUrl)];
                case 15:
                    _x.sent();
                    (0, circuit_breaker_1.recordSuccess)('connect');
                    return [3 /*break*/, 19];
                case 16:
                    e_4 = _x.sent();
                    (0, circuit_breaker_1.recordFailure)('connect', e_4.message);
                    throw e_4;
                case 17: return [4 /*yield*/, page.close()];
                case 18:
                    _x.sent();
                    return [7 /*endfinally*/];
                case 19: return [4 /*yield*/, (0, session_1.saveSessionState)(accountId)];
                case 20:
                    _x.sent();
                    db.prepare("UPDATE targets SET connection_requested_at = ? WHERE id = ?").run(nowIso(), target.id);
                    trWait(db, tr, CONNECTION_RECHECK_HOURS);
                    log(db, runId, target.id, "info", "Connection request sent to ".concat(name, " \u2014 will recheck in ").concat(CONNECTION_RECHECK_HOURS, "h"));
                    return [3 /*break*/, 55];
                case 21:
                    if (!(step.step_type === "message")) return [3 /*break*/, 37];
                    return [4 /*yield*/, ensureSalesNavEnriched(db, target, accountId)];
                case 22:
                    _x.sent();
                    if (!enforceSchedule(db, tr, runId, target.id, name, accountLimits))
                        return [2 /*return*/];
                    freshTarget = db.prepare("SELECT * FROM targets WHERE id = ?").get(target.id);
                    if (freshTarget.degree !== 1) {
                        requested = freshTarget.connection_requested_at;
                        if (requested && hoursSince(requested) / 24 > CONNECTION_MAX_WAIT_DAYS) {
                            log(db, runId, target.id, "warn", "".concat(name, " never accepted \u2014 skipping message step"));
                            trSkip(db, tr, "Never accepted connection");
                            return [2 /*return*/];
                        }
                        log(db, runId, target.id, "info", "".concat(name, " not yet connected \u2014 rescheduling message in ").concat(CONNECTION_RECHECK_HOURS, "h"));
                        trWait(db, tr, CONNECTION_RECHECK_HOURS);
                        return [2 /*return*/];
                    }
                    messageText = "";
                    if (!step.ai_enabled) return [3 /*break*/, 24];
                    if (!(premium_1.premium === null || premium_1.premium === void 0 ? void 0 : premium_1.premium.ai)) {
                        log(db, runId, target.id, "warn", "AI writer is a premium feature \u2014 not available in this build. Skipping ".concat(name));
                        trAdvance(db, tr, steps);
                        return [2 /*return*/];
                    }
                    integration = db.prepare("SELECT api_key FROM integrations WHERE key = 'openrouter'").get();
                    apiKey = process.env.OPENAI_API_KEY || ((integration === null || integration === void 0 ? void 0 : integration.api_key) ? (0, crypto_2.decryptSecret)(integration.api_key) : null);
                    agentCfgForMsg = premium_1.premium.ai.getAgentConfig();
                    resolvedMsgModel = step.ai_model || agentCfgForMsg.default_model || "gpt-4o-mini";
                    if (!apiKey || !resolvedMsgModel) {
                        log(db, runId, target.id, "warn", "AI enabled on message step but API key or model missing \u2014 skipping ".concat(name));
                        trAdvance(db, tr, steps);
                        return [2 /*return*/];
                    }
                    contactData = premium_1.premium.ai.getContactWithCompany(target.id);
                    if (!contactData) {
                        log(db, runId, target.id, "warn", "Could not load contact data for AI message \u2014 skipping ".concat(name));
                        trAdvance(db, tr, steps);
                        return [2 /*return*/];
                    }
                    log(db, runId, target.id, "info", "Generating AI message for ".concat(name, " with ").concat(resolvedMsgModel));
                    msgPosition = (_c = step.message_position) !== null && _c !== void 0 ? _c : 1;
                    previousMessageContext = void 0;
                    if (msgPosition > 1 && tr.last_linkedin_message) {
                        previousMessageContext = { followupNumber: msgPosition - 1, previousMessage: tr.last_linkedin_message };
                    }
                    return [4 /*yield*/, premium_1.premium.ai.writeLinkedInMessage({
                            apiKey: apiKey,
                            model: resolvedMsgModel,
                            stepType: "message",
                            stepPrompt: (_d = step.ai_prompt) !== null && _d !== void 0 ? _d : "",
                            maxWords: (_e = step.ai_max_words) !== null && _e !== void 0 ? _e : undefined,
                            language: (_f = step.ai_language) !== null && _f !== void 0 ? _f : undefined,
                            campaignPrompt: campaignPrompt !== null && campaignPrompt !== void 0 ? campaignPrompt : undefined,
                            contact: contactData.contact,
                            company: contactData.company,
                            agentConfig: agentCfgForMsg,
                            previousMessageContext: previousMessageContext,
                            runId: runId,
                            targetId: target.id,
                            stepId: step.id,
                        })];
                case 23:
                    result = _x.sent();
                    messageText = result.body;
                    return [3 /*break*/, 25];
                case 24:
                    multiTemplateIds = db.prepare("SELECT template_id FROM workflow_step_templates WHERE step_id = ?").all(step.id).map(function (r) { return r.template_id; });
                    if (multiTemplateIds.length > 0) {
                        randomId = multiTemplateIds[Math.floor(Math.random() * multiTemplateIds.length)];
                        tmpl = db.prepare("SELECT * FROM templates WHERE id = ?").get(randomId);
                        if (tmpl)
                            messageText = renderTemplate(tmpl.body, freshTarget);
                    }
                    else if (step.template_id) {
                        tmpl = db.prepare("SELECT * FROM templates WHERE id = ?").get(step.template_id);
                        if (tmpl)
                            messageText = renderTemplate(tmpl.body, freshTarget);
                    }
                    if (!messageText && step.message_body)
                        messageText = renderTemplate(step.message_body, freshTarget);
                    _x.label = 25;
                case 25:
                    if (!messageText) {
                        log(db, runId, target.id, "warn", "No message body for message step \u2014 skipping ".concat(name));
                        trAdvance(db, tr, steps);
                        return [2 /*return*/];
                    }
                    db.prepare("UPDATE run_profile_tracks SET last_step_at = datetime('now') WHERE id = ?").run(tr.id);
                    log(db, runId, target.id, "info", "Sending message to ".concat(name));
                    return [4 /*yield*/, getLinkedinUrl(db, target, accountId)];
                case 26:
                    messageLinkedinUrl = _x.sent();
                    return [4 /*yield*/, (0, session_1.getSessionPage)(accountId)];
                case 27:
                    page = _x.sent();
                    _x.label = 28;
                case 28:
                    _x.trys.push([28, 30, 33, 35]);
                    if (!target.full_name)
                        throw new Error("Target ".concat(target.id, " has no full_name \u2014 cannot search messaging"));
                    return [4 /*yield*/, (0, message_1.sendMessage)(page, target.full_name, messageText, messageLinkedinUrl, freshTarget.messaging_urn)];
                case 29:
                    result = _x.sent();
                    (0, circuit_breaker_1.recordSuccess)('message');
                    if (result.messagingUrn) {
                        db.prepare("UPDATE targets SET messaging_urn = COALESCE(messaging_urn, ?) WHERE id = ?").run(result.messagingUrn, target.id);
                    }
                    return [3 /*break*/, 35];
                case 30:
                    err_1 = _x.sent();
                    (0, circuit_breaker_1.recordFailure)('message', err_1.message);
                    if (!(err_1 instanceof message_1.NotConnectedError)) return [3 /*break*/, 32];
                    return [4 /*yield*/, (0, session_1.saveSessionState)(accountId)];
                case 31:
                    _x.sent();
                    db.prepare("UPDATE targets SET degree = NULL, connected_at = NULL WHERE id = ?").run(target.id);
                    log(db, runId, target.id, "warn", "".concat(name, " no longer appears 1st-degree \u2014 resetting connection status and rescheduling"));
                    trWait(db, tr, CONNECTION_RECHECK_HOURS);
                    return [2 /*return*/];
                case 32: throw err_1;
                case 33: return [4 /*yield*/, page.close()];
                case 34:
                    _x.sent();
                    return [7 /*endfinally*/];
                case 35: return [4 /*yield*/, (0, session_1.saveSessionState)(accountId)];
                case 36:
                    _x.sent();
                    db.prepare("UPDATE targets SET message_sent_at = ? WHERE id = ?").run(nowIso(), target.id);
                    trRecordContext(db, tr, { linkedinMessage: messageText });
                    trAdvance(db, tr, steps);
                    log(db, runId, target.id, "info", "Message sent to ".concat(name));
                    return [3 /*break*/, 55];
                case 37:
                    if (!(step.step_type === "sales_inmail")) return [3 /*break*/, 49];
                    // Sales Navigator InMail — reaches NON-connections (no degree gate), needs a
                    // subject + body, costs one InMail credit. Body config mirrors the message
                    // step (AI writer OR templates OR raw body); subject comes from email_subject.
                    if (!(premium_1.premium === null || premium_1.premium === void 0 ? void 0 : premium_1.premium.inmail)) {
                        log(db, runId, target.id, "warn", "Sales Nav InMail is a premium feature \u2014 not available in this build. Skipping ".concat(name));
                        trAdvance(db, tr, steps);
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, ensureSalesNavEnriched(db, target, accountId)];
                case 38:
                    _x.sent();
                    if (!enforceSchedule(db, tr, runId, target.id, name, accountLimits))
                        return [2 /*return*/];
                    freshTarget = db.prepare("SELECT * FROM targets WHERE id = ?").get(target.id);
                    if (!freshTarget.sales_nav_url) {
                        log(db, runId, target.id, "warn", "".concat(name, " has no Sales Nav URL \u2014 cannot send InMail, skipping"));
                        trSkip(db, tr, "No Sales Nav URL for InMail");
                        return [2 /*return*/];
                    }
                    inmailBody = "";
                    inmailSubject = "";
                    if (!step.ai_enabled) return [3 /*break*/, 40];
                    if (!(premium_1.premium === null || premium_1.premium === void 0 ? void 0 : premium_1.premium.ai)) {
                        log(db, runId, target.id, "warn", "AI writer is a premium feature \u2014 not available in this build. Skipping ".concat(name));
                        trAdvance(db, tr, steps);
                        return [2 /*return*/];
                    }
                    integration = db.prepare("SELECT api_key FROM integrations WHERE key = 'openrouter'").get();
                    apiKey = process.env.OPENAI_API_KEY || ((integration === null || integration === void 0 ? void 0 : integration.api_key) ? (0, crypto_2.decryptSecret)(integration.api_key) : null);
                    agentCfgForMsg = premium_1.premium.ai.getAgentConfig();
                    resolvedMsgModel = step.ai_model || agentCfgForMsg.default_model || "gpt-4o-mini";
                    if (!apiKey || !resolvedMsgModel) {
                        log(db, runId, target.id, "warn", "AI enabled on InMail step but API key or model missing \u2014 skipping ".concat(name));
                        trAdvance(db, tr, steps);
                        return [2 /*return*/];
                    }
                    contactData = premium_1.premium.ai.getContactWithCompany(target.id);
                    if (!contactData) {
                        log(db, runId, target.id, "warn", "Could not load contact data for AI InMail \u2014 skipping ".concat(name));
                        trAdvance(db, tr, steps);
                        return [2 /*return*/];
                    }
                    log(db, runId, target.id, "info", "Generating AI InMail for ".concat(name, " with ").concat(resolvedMsgModel));
                    msgPosition = (_g = step.message_position) !== null && _g !== void 0 ? _g : 1;
                    previousMessageContext = void 0;
                    if (msgPosition > 1 && tr.last_linkedin_message) {
                        previousMessageContext = { followupNumber: msgPosition - 1, previousMessage: tr.last_linkedin_message };
                    }
                    return [4 /*yield*/, premium_1.premium.ai.writeSalesInMail({
                            apiKey: apiKey,
                            model: resolvedMsgModel,
                            stepType: "sales_inmail",
                            stepPrompt: (_h = step.ai_prompt) !== null && _h !== void 0 ? _h : "",
                            maxWords: (_j = step.ai_max_words) !== null && _j !== void 0 ? _j : undefined,
                            language: (_k = step.ai_language) !== null && _k !== void 0 ? _k : undefined,
                            campaignPrompt: campaignPrompt !== null && campaignPrompt !== void 0 ? campaignPrompt : undefined,
                            contact: contactData.contact,
                            company: contactData.company,
                            agentConfig: agentCfgForMsg,
                            previousMessageContext: previousMessageContext,
                            runId: runId,
                            targetId: target.id,
                            stepId: step.id,
                        })];
                case 39:
                    result = _x.sent();
                    inmailBody = result.body;
                    inmailSubject = result.subject;
                    return [3 /*break*/, 41];
                case 40:
                    multiTemplateIds = db.prepare("SELECT template_id FROM workflow_step_templates WHERE step_id = ?").all(step.id).map(function (r) { return r.template_id; });
                    if (multiTemplateIds.length > 0) {
                        randomId = multiTemplateIds[Math.floor(Math.random() * multiTemplateIds.length)];
                        tmpl = db.prepare("SELECT * FROM templates WHERE id = ?").get(randomId);
                        if (tmpl)
                            inmailBody = renderTemplate(tmpl.body, freshTarget);
                    }
                    else if (step.template_id) {
                        tmpl = db.prepare("SELECT * FROM templates WHERE id = ?").get(step.template_id);
                        if (tmpl)
                            inmailBody = renderTemplate(tmpl.body, freshTarget);
                    }
                    if (!inmailBody && step.message_body)
                        inmailBody = renderTemplate(step.message_body, freshTarget);
                    inmailSubject = renderTemplate((_l = step.email_subject) !== null && _l !== void 0 ? _l : "", freshTarget).trim();
                    _x.label = 41;
                case 41:
                    if (!inmailBody) {
                        log(db, runId, target.id, "warn", "No body for InMail step \u2014 skipping ".concat(name));
                        trAdvance(db, tr, steps);
                        return [2 /*return*/];
                    }
                    if (!inmailSubject) {
                        log(db, runId, target.id, "warn", "No subject for InMail step (required) \u2014 skipping ".concat(name));
                        trAdvance(db, tr, steps);
                        return [2 /*return*/];
                    }
                    db.prepare("UPDATE run_profile_tracks SET last_step_at = datetime('now') WHERE id = ?").run(tr.id);
                    log(db, runId, target.id, "info", "Sending InMail to ".concat(name));
                    return [4 /*yield*/, (0, session_1.getSessionPage)(accountId)];
                case 42:
                    page = _x.sent();
                    _x.label = 43;
                case 43:
                    _x.trys.push([43, , 45, 47]);
                    return [4 /*yield*/, premium_1.premium.inmail.sendInMail(page, freshTarget.sales_nav_url, inmailSubject, inmailBody)];
                case 44:
                    _x.sent();
                    return [3 /*break*/, 47];
                case 45: return [4 /*yield*/, page.close()];
                case 46:
                    _x.sent();
                    return [7 /*endfinally*/];
                case 47: return [4 /*yield*/, (0, session_1.saveSessionState)(accountId)];
                case 48:
                    _x.sent();
                    db.prepare("UPDATE targets SET inmail_sent_at = ?, message_sent_at = COALESCE(message_sent_at, ?) WHERE id = ?").run(nowIso(), nowIso(), target.id);
                    trRecordContext(db, tr, { linkedinMessage: inmailBody });
                    trAdvance(db, tr, steps);
                    log(db, runId, target.id, "info", "InMail sent to ".concat(name));
                    return [3 /*break*/, 55];
                case 49:
                    if (!(step.step_type === "email")) return [3 /*break*/, 55];
                    return [4 /*yield*/, ensureApolloEnriched(db, target, runId)];
                case 50:
                    _x.sent();
                    if (!emailAccountId || !emailAccountLimits) {
                        log(db, runId, target.id, "warn", "Email step skipped \u2014 no email account configured on this run");
                        trAdvance(db, tr, steps);
                        return [2 /*return*/];
                    }
                    if (!enforceSchedule(db, tr, runId, target.id, name, emailAccountLimits))
                        return [2 /*return*/];
                    freshTarget = db.prepare("SELECT * FROM targets WHERE id = ?").get(target.id);
                    if (!freshTarget.email) {
                        // No email even after Apollo enrichment — skip only this email track
                        log(db, runId, target.id, "warn", "".concat(name, " has no email address \u2014 skipping email track"));
                        trSkip(db, tr, "No email address found");
                        return [2 /*return*/];
                    }
                    if (freshTarget.email_status === "invalid") {
                        log(db, runId, target.id, "warn", "".concat(name, " has an invalid email address \u2014 unenrolling email track"));
                        trSkip(db, tr, "Email bounced — invalid address");
                        return [2 /*return*/];
                    }
                    if (freshTarget.company_id) {
                        company = db.prepare("SELECT email_domain_invalid FROM companies WHERE id = ?").get(freshTarget.company_id);
                        if (company === null || company === void 0 ? void 0 : company.email_domain_invalid) {
                            log(db, runId, target.id, "warn", "".concat(name, "'s company email domain is flagged invalid \u2014 unenrolling email track"));
                            trSkip(db, tr, "Email domain invalid — company flagged");
                            return [2 /*return*/];
                        }
                    }
                    emailSubject = "";
                    emailBody = "";
                    if (!step.ai_enabled) return [3 /*break*/, 52];
                    if (!(premium_1.premium === null || premium_1.premium === void 0 ? void 0 : premium_1.premium.ai)) {
                        log(db, runId, target.id, "warn", "AI writer is a premium feature \u2014 not available in this build. Skipping ".concat(name));
                        trAdvance(db, tr, steps);
                        return [2 /*return*/];
                    }
                    integration = db.prepare("SELECT api_key FROM integrations WHERE key = 'openrouter'").get();
                    apiKey = process.env.OPENAI_API_KEY || ((integration === null || integration === void 0 ? void 0 : integration.api_key) ? (0, crypto_2.decryptSecret)(integration.api_key) : null);
                    agentCfgForEmail = premium_1.premium.ai.getAgentConfig();
                    resolvedEmailModel = step.ai_model || agentCfgForEmail.default_model || "gpt-4o-mini";
                    if (!apiKey || !resolvedEmailModel) {
                        log(db, runId, target.id, "warn", "AI enabled on email step but API key or model missing \u2014 skipping ".concat(name));
                        trAdvance(db, tr, steps);
                        return [2 /*return*/];
                    }
                    contactData = premium_1.premium.ai.getContactWithCompany(target.id);
                    if (!contactData) {
                        log(db, runId, target.id, "warn", "Could not load contact data for AI email \u2014 skipping ".concat(name));
                        trAdvance(db, tr, steps);
                        return [2 /*return*/];
                    }
                    log(db, runId, target.id, "info", "Generating AI email for ".concat(name, " with ").concat(resolvedEmailModel));
                    emailPosition = (_m = step.email_position) !== null && _m !== void 0 ? _m : 1;
                    followupContext = void 0;
                    if (emailPosition > 1 && (tr.last_email_subject || tr.last_email_body)) {
                        followupContext = {
                            followupNumber: emailPosition - 1,
                            previousSubject: (_o = tr.last_email_subject) !== null && _o !== void 0 ? _o : "",
                            previousBody: (_p = tr.last_email_body) !== null && _p !== void 0 ? _p : "",
                        };
                    }
                    return [4 /*yield*/, premium_1.premium.ai.writeEmail({
                            apiKey: apiKey,
                            model: resolvedEmailModel,
                            stepType: "email",
                            stepPrompt: (_q = step.ai_prompt) !== null && _q !== void 0 ? _q : "",
                            maxWords: (_r = step.ai_max_words) !== null && _r !== void 0 ? _r : undefined,
                            language: (_s = step.ai_language) !== null && _s !== void 0 ? _s : undefined,
                            campaignPrompt: campaignPrompt !== null && campaignPrompt !== void 0 ? campaignPrompt : undefined,
                            contact: contactData.contact,
                            company: contactData.company,
                            agentConfig: agentCfgForEmail,
                            followupContext: followupContext,
                            replyContext: (_t = tr.pending_reply_context) !== null && _t !== void 0 ? _t : undefined,
                            runId: runId,
                            targetId: target.id,
                            stepId: step.id,
                        })];
                case 51:
                    result = _x.sent();
                    emailSubject = result.subject;
                    emailBody = result.body;
                    // One-shot: consume the OOO reply context so later follow-ups don't re-acknowledge it
                    if (tr.pending_reply_context) {
                        db.prepare("UPDATE run_profile_tracks SET pending_reply_context = NULL WHERE id = ?").run(tr.id);
                    }
                    return [3 /*break*/, 53];
                case 52:
                    emailSubject = renderTemplate((_u = step.email_subject) !== null && _u !== void 0 ? _u : "", freshTarget);
                    emailBody = renderTemplate((_v = step.email_body) !== null && _v !== void 0 ? _v : "", freshTarget);
                    _x.label = 53;
                case 53:
                    if (!emailBody) {
                        log(db, runId, target.id, "warn", "No email body for email step \u2014 skipping ".concat(name));
                        trAdvance(db, tr, steps);
                        return [2 /*return*/];
                    }
                    emailAccount = db.prepare("SELECT * FROM email_accounts WHERE id = ?").get(emailAccountId);
                    if (!emailAccount) {
                        log(db, runId, target.id, "error", "Email account ".concat(emailAccountId, " not found"));
                        trFail(db, tr, "Email account missing");
                        return [2 /*return*/];
                    }
                    sentTodayActual = db.prepare("SELECT COUNT(*) as c FROM logs l\n         WHERE l.message LIKE 'Email sent%'\n         AND date(l.created_at) = date('now')\n         AND EXISTS (\n           SELECT 1 FROM run_profiles rp\n           WHERE rp.run_id = l.run_id AND rp.target_id = l.target_id\n           AND rp.email_account_id = ?\n         )").get(emailAccountId).c;
                    hardLimit = effectiveEmailLimit(emailAccountLimits);
                    if (sentTodayActual >= hardLimit) {
                        log(db, runId, target.id, "warn", "Daily limit guard tripped for ".concat(emailAccountId, " (").concat(sentTodayActual, "/").concat(hardLimit, ") \u2014 rescheduling ").concat(name, " to tomorrow"));
                        trReschedule(db, tr, rescheduleToTomorrow(emailAccountLimits));
                        return [2 /*return*/];
                    }
                    sig = (_w = (step.email_signature !== null ? step.email_signature : emailAccount.signature)) === null || _w === void 0 ? void 0 : _w.trim();
                    finalEmailBody = sig ? "".concat(emailBody, "\n\n--\n").concat(sig) : emailBody;
                    db.prepare("UPDATE run_profile_tracks SET last_step_at = datetime('now') WHERE id = ?").run(tr.id);
                    log(db, runId, target.id, "info", "Sending email to ".concat(name, " <").concat(freshTarget.email, ">"));
                    return [4 /*yield*/, (0, sender_1.sendEmail)(__assign(__assign({}, emailAccount), { password: (0, crypto_2.decryptSecret)(emailAccount.password) }), freshTarget.email, emailSubject, finalEmailBody)];
                case 54:
                    messageId = _x.sent();
                    trRecordContext(db, tr, { emailSubject: emailSubject, emailBody: emailBody, emailMessageId: messageId });
                    trAdvance(db, tr, steps);
                    log(db, runId, target.id, "info", "Email sent to ".concat(name));
                    _x.label = 55;
                case 55: return [3 /*break*/, 57];
                case 56:
                    err_2 = _x.sent();
                    (0, circuit_breaker_1.recordFailure)('message', err_2.message);
                    msg = err_2 instanceof Error ? err_2.message : String(err_2);
                    if (err_2 instanceof connect_1.WeeklyLimitError) {
                        log(db, runId, target.id, "error", "Weekly connection limit reached \u2014 pausing run");
                        db.prepare("UPDATE runs SET status = 'paused' WHERE id = ?").run(runId);
                        return [2 /*return*/];
                    }
                    if (err_2 instanceof connect_1.AlreadyConnectedError) {
                        log(db, runId, target.id, "info", "".concat(name, " already connected \u2014 advancing"));
                        db.prepare("UPDATE targets SET degree = 1, connected_at = COALESCE(connected_at, ?) WHERE id = ?").run(nowIso(), target.id);
                        trAdvance(db, tr, steps);
                        return [2 /*return*/];
                    }
                    if (err_2 instanceof connect_1.PendingInviteError) {
                        log(db, runId, target.id, "info", "".concat(name, " invite already pending \u2014 will recheck"));
                        if (!target.connection_requested_at)
                            db.prepare("UPDATE targets SET connection_requested_at = ? WHERE id = ?").run(nowIso(), target.id);
                        trWait(db, tr, CONNECTION_RECHECK_HOURS);
                        return [2 /*return*/];
                    }
                    if (msg.includes("No InMail credits left")) {
                        inmailCreditsExhaustedOn[accountId] = todayLocalDate();
                        slot = rescheduleToTomorrow(accountLimits);
                        log(db, runId, target.id, "warn", "No InMail credits left on this account \u2014 pausing InMail sends until tomorrow, rescheduled ".concat(name, " to ").concat(slot));
                        trReschedule(db, tr, slot);
                        return [2 /*return*/];
                    }
                    log(db, runId, target.id, "error", "Error on ".concat(name, ": ").concat(msg));
                    trFail(db, tr, msg);
                    return [3 /*break*/, 57];
                case 57: return [2 /*return*/];
            }
        });
    });
}
// ─── global loop ─────────────────────────────────────────────────────────────
var g = global;
function ensureGlobalRunnerStarted() {
    if (g.__linkiGlobalRunnerStarted)
        return;
    g.__linkiGlobalRunnerStarted = true;
    globalLoop().catch(function (err) { return console.error("[runner] Global loop crashed:", err); });
}
function globalLoop() {
    return __awaiter(this, void 0, void 0, function () {
        var db, syncLoop, actionLoop;
        var _this = this;
        return __generator(this, function (_a) {
            console.log("[runner] Global loop started");
            db = (0, db_1.getDb)();
            syncLoop = function () { return __awaiter(_this, void 0, void 0, function () {
                var err_3;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!true) return [3 /*break*/, 6];
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, tickSync(db)];
                        case 2:
                            _a.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            err_3 = _a.sent();
                            (0, circuit_breaker_1.recordFailure)('message', err_3.message);
                            console.error("[runner] Sync tick error:", err_3 instanceof Error ? err_3.message : err_3);
                            return [3 /*break*/, 4];
                        case 4: return [4 /*yield*/, sleep(5 * 60 * 1000)];
                        case 5:
                            _a.sent(); // 5 min
                            return [3 /*break*/, 0];
                        case 6: return [2 /*return*/];
                    }
                });
            }); };
            actionLoop = function () { return __awaiter(_this, void 0, void 0, function () {
                var err_4, processScheduledImports, err_5;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!true) return [3 /*break*/, 10];
                            _a.label = 1;
                        case 1:
                            _a.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, tickActions(db)];
                        case 2:
                            _a.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            err_4 = _a.sent();
                            (0, circuit_breaker_1.recordFailure)('message', err_4.message);
                            console.error("[runner] Action tick error:", err_4 instanceof Error ? err_4.message : err_4);
                            return [3 /*break*/, 4];
                        case 4:
                            _a.trys.push([4, 7, , 8]);
                            return [4 /*yield*/, Promise.resolve().then(function () { return require("@/lib/import-jobs"); })];
                        case 5:
                            processScheduledImports = (_a.sent()).processScheduledImports;
                            return [4 /*yield*/, processScheduledImports(db)];
                        case 6:
                            _a.sent();
                            return [3 /*break*/, 8];
                        case 7:
                            err_5 = _a.sent();
                            (0, circuit_breaker_1.recordFailure)('message', err_5.message);
                            console.error("[runner] Import scheduler error:", err_5 instanceof Error ? err_5.message : err_5);
                            return [3 /*break*/, 8];
                        case 8: return [4 /*yield*/, sleep(POLL_INTERVAL_MS)];
                        case 9:
                            _a.sent();
                            return [3 /*break*/, 0];
                        case 10: return [2 /*return*/];
                    }
                });
            }); };
            Promise.all([syncLoop(), actionLoop()]).catch(function (e) { return console.error(e); });
            return [2 /*return*/];
        });
    });
}
function tickSync(db) {
    return __awaiter(this, void 0, void 0, function () {
        var premium_2, e_5, activeRuns, allAuthenticatedAccounts, allAccountIds, _i, allAuthenticatedAccounts_1, account, accountId, lastWithdraw, page, e_6, stamped, e_7, _a, allAccountIds_1, accountId, acc, lastSync, dueAfterMs, isDue, syncResult, e_8, activeRunIds, activeEmailAccountIds, seenEmailAccounts, _b, activeEmailAccountIds_1, emailAccId, e_9;
        var _c;
        var _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if ((0, circuit_breaker_1.isBreakerTripped)())
                        return [2 /*return*/];
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 4, , 5]);
                    premium_2 = require("@/ee").premium;
                    if (!((_d = premium_2 === null || premium_2 === void 0 ? void 0 : premium_2.replies) === null || _d === void 0 ? void 0 : _d.retryFailed)) return [3 /*break*/, 3];
                    return [4 /*yield*/, premium_2.replies.retryFailed()];
                case 2:
                    _e.sent();
                    _e.label = 3;
                case 3: return [3 /*break*/, 5];
                case 4:
                    e_5 = _e.sent();
                    return [3 /*break*/, 5];
                case 5:
                    activeRuns = db.prepare("\n    SELECT r.id as run_id, r.workflow_id, r.account_id, r.email_account_id,\n           a.daily_connection_limit, a.daily_message_limit, a.daily_inmail_limit,\n           a.active_hours_start, a.active_hours_end, a.timezone, a.working_days\n    FROM runs r\n    JOIN accounts a ON a.id = r.account_id\n    WHERE r.status = 'running' AND a.is_authenticated = 1\n  ").all();
                    allAuthenticatedAccounts = db.prepare("SELECT id, withdraw_invites_after_days FROM accounts WHERE is_authenticated = 1").all();
                    allAccountIds = allAuthenticatedAccounts.map(function (a) { return a.id; });
                    _i = 0, allAuthenticatedAccounts_1 = allAuthenticatedAccounts;
                    _e.label = 6;
                case 6:
                    if (!(_i < allAuthenticatedAccounts_1.length)) return [3 /*break*/, 17];
                    account = allAuthenticatedAccounts_1[_i];
                    accountId = account.id;
                    if (!account.withdraw_invites_after_days) return [3 /*break*/, 12];
                    lastWithdraw = withdrawSyncs.get(accountId) || 0;
                    if (!(Date.now() - lastWithdraw >= 24 * 60 * 60 * 1000)) return [3 /*break*/, 12];
                    withdrawSyncs.set(accountId, Date.now());
                    _e.label = 7;
                case 7:
                    _e.trys.push([7, 11, , 12]);
                    return [4 /*yield*/, (0, session_1.getSessionPage)(accountId)];
                case 8:
                    page = _e.sent();
                    return [4 /*yield*/, (0, withdraw_1.withdrawOldInvitations)(page, accountId, account.withdraw_invites_after_days, null)];
                case 9:
                    _e.sent();
                    (0, circuit_breaker_1.recordSuccess)('withdraw');
                    return [4 /*yield*/, page.close()];
                case 10:
                    _e.sent();
                    return [3 /*break*/, 12];
                case 11:
                    e_6 = _e.sent();
                    console.warn("[runner] Withdraw old invites error:", e_6 instanceof Error ? e_6.message : e_6);
                    (0, circuit_breaker_1.recordFailure)('withdraw', e_6 instanceof Error ? e_6.message : String(e_6));
                    return [3 /*break*/, 12];
                case 12:
                    if (!(0, sync_accepted_1.shouldSyncAccepted)(accountId)) return [3 /*break*/, 16];
                    _e.label = 13;
                case 13:
                    _e.trys.push([13, 15, , 16]);
                    return [4 /*yield*/, (0, sync_accepted_1.syncAcceptedConnections)(accountId)];
                case 14:
                    stamped = _e.sent();
                    return [3 /*break*/, 16];
                case 15:
                    e_7 = _e.sent();
                    console.warn("[runner] Accepted-connections sync error:", e_7 instanceof Error ? e_7.message : e_7);
                    return [3 /*break*/, 16];
                case 16:
                    _i++;
                    return [3 /*break*/, 6];
                case 17:
                    _a = 0, allAccountIds_1 = allAccountIds;
                    _e.label = 18;
                case 18:
                    if (!(_a < allAccountIds_1.length)) return [3 /*break*/, 24];
                    accountId = allAccountIds_1[_a];
                    acc = db.prepare("SELECT is_authenticated FROM accounts WHERE id = ?").get(accountId);
                    if (!(acc && acc.is_authenticated)) return [3 /*break*/, 23];
                    lastSync = lastLinkedinSync.get(accountId) || 0;
                    dueAfterMs = inbox_1.IMAP_POLL_INTERVAL_MS + (0, inbox_1.accountJitterMs)(accountId);
                    isDue = Date.now() - lastSync >= dueAfterMs;
                    if (!(isDue && !activeLinkedinSyncs.has(accountId))) return [3 /*break*/, 23];
                    activeLinkedinSyncs.add(accountId);
                    _e.label = 19;
                case 19:
                    _e.trys.push([19, 21, 22, 23]);
                    return [4 /*yield*/, (0, inbox_sync_1.syncLinkedInInboxReadOnly)({ accountId: accountId, source: new inbox_observer_1.LinkedInNetworkObserver() })];
                case 20:
                    syncResult = _e.sent();
                    return [3 /*break*/, 23];
                case 21:
                    e_8 = _e.sent();
                    console.warn("[runner] LinkedIn inbox sync error:", e_8 instanceof Error ? e_8.message : e_8);
                    return [3 /*break*/, 23];
                case 22:
                    lastLinkedinSync.set(accountId, Date.now());
                    activeLinkedinSyncs.delete(accountId);
                    return [7 /*endfinally*/];
                case 23:
                    _a++;
                    return [3 /*break*/, 18];
                case 24:
                    activeRunIds = activeRuns.map(function (r) { return r.run_id; });
                    activeEmailAccountIds = activeRunIds.length > 0
                        ? __spreadArray([], new Set((_c = db.prepare("SELECT DISTINCT rp.email_account_id FROM run_profiles rp\n           JOIN run_profile_tracks rt ON rt.run_profile_id = rp.id\n           WHERE rp.run_id IN (".concat(activeRunIds.map(function () { return "?"; }).join(","), ")\n           AND rp.email_account_id IS NOT NULL\n           AND rt.state NOT IN ('completed', 'failed', 'skipped')"))).all.apply(_c, activeRunIds).map(function (r) { return r.email_account_id; })), true) : [];
                    seenEmailAccounts = new Set();
                    _b = 0, activeEmailAccountIds_1 = activeEmailAccountIds;
                    _e.label = 25;
                case 25:
                    if (!(_b < activeEmailAccountIds_1.length)) return [3 /*break*/, 32];
                    emailAccId = activeEmailAccountIds_1[_b];
                    if (seenEmailAccounts.has(emailAccId))
                        return [3 /*break*/, 31];
                    seenEmailAccounts.add(emailAccId);
                    if (!(0, inbox_1.shouldSyncEmailInbox)(emailAccId)) return [3 /*break*/, 31];
                    _e.label = 26;
                case 26:
                    _e.trys.push([26, 28, , 29]);
                    return [4 /*yield*/, (0, inbox_1.syncEmailInbox)(emailAccId)];
                case 27:
                    _e.sent();
                    return [3 /*break*/, 29];
                case 28:
                    e_9 = _e.sent();
                    console.warn("[runner] Email inbox sync error:", e_9 instanceof Error ? e_9.message : e_9);
                    return [3 /*break*/, 29];
                case 29: return [4 /*yield*/, sleep(2000)];
                case 30:
                    _e.sent();
                    _e.label = 31;
                case 31:
                    _b++;
                    return [3 /*break*/, 25];
                case 32: return [2 /*return*/];
            }
        });
    });
}
function tickActions(db) {
    return __awaiter(this, void 0, void 0, function () {
        var activeRuns, _i, activeRuns_1, run, remaining, stillActive, accountLimitsMap, _a, stillActive_1, run, stillActiveRunIds, emailAccountIds, emailAccountLimitsMap, _b, emailAccountIds_1, emailAccountId, ea, connectsSentToday, messagesSentToday, inmailsSentToday, _c, accountLimitsMap_1, accountId, c, m, im, emailsSentToday, _d, emailAccountIds_2, emailAccountId, e, stepsCache, getSteps, workflowPromptCache, getWorkflowPrompt, runIds, placeholders, dueTrackRuns, connectSlotsRemaining, inmailSlotsRemaining, firstLinkedinStepCache, getFirstLinkedinStepType, enrolledEmailPairs, _e, stillActive_2, run, limits, firstStepType, isInmailFirst, slotsRemaining, dailyLimit, sentToday, actionsLeft, firstStepTypeSql, scheduledToday, slotsLeft, toEnroll, pending, runEmailAccountIds, _f, runEmailAccountIds_1, emailAccId, emailKey, emailLimits, effectiveLimit, emailsLeft, emailScheduledToday, emailSlotsLeft, pendingEmail, toExecute, toReschedule, connectsPlanned, messagesPlanned, inmailsPlanned, emailsPlanned, _g, dueTrackRuns_1, tr, steps, stepIndex, step, limits, sentToday, planned, sentToday, planned, sentToday, planned, profileEmailAccountId, emailLimits, sentToday, planned, effectiveLimit, _h, toReschedule_1, tr, limits, slot, _j, toExecute_1, tr, steps, limits, emailAccountId, emailLimits, runStatus, target;
        var _k, _l;
        var _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4;
        return __generator(this, function (_5) {
            switch (_5.label) {
                case 0:
                    if ((0, circuit_breaker_1.isBreakerTripped)())
                        return [2 /*return*/];
                    activeRuns = db.prepare("\n    SELECT r.id as run_id, r.workflow_id, r.account_id, r.email_account_id,\n           a.daily_connection_limit, a.daily_message_limit, a.daily_inmail_limit,\n           a.active_hours_start, a.active_hours_end, a.timezone, a.working_days\n    FROM runs r\n    JOIN accounts a ON a.id = r.account_id\n    WHERE r.status = 'running' AND a.is_authenticated = 1\n  ").all();
                    if (activeRuns.length > 0) {
                        console.log("[runner] Tick \u2014 ".concat(activeRuns.length, " active run(s)"));
                    }
                    // Auto-complete runs where ALL track-runs across all profiles are terminal
                    for (_i = 0, activeRuns_1 = activeRuns; _i < activeRuns_1.length; _i++) {
                        run = activeRuns_1[_i];
                        remaining = db.prepare("SELECT COUNT(*) as c FROM run_profile_tracks rt\n       JOIN run_profiles rp ON rp.id = rt.run_profile_id\n       WHERE rp.run_id = ? AND rt.state NOT IN ('completed', 'failed', 'skipped')").get(run.run_id).c;
                        if (remaining === 0) {
                            db.prepare("UPDATE runs SET status = 'completed', completed_at = datetime('now') WHERE id = ?").run(run.run_id);
                            log(db, run.run_id, null, "info", "All profiles processed — run completed");
                        }
                    }
                    stillActive = db.prepare("\n    SELECT r.id as run_id, r.workflow_id, r.account_id, r.email_account_id,\n           a.daily_connection_limit, a.daily_message_limit, a.daily_inmail_limit,\n           a.active_hours_start, a.active_hours_end, a.timezone, a.working_days\n    FROM runs r\n    JOIN accounts a ON a.id = r.account_id\n    WHERE r.status = 'running'\n  ").all();
                    if (stillActive.length === 0)
                        return [2 /*return*/];
                    accountLimitsMap = new Map();
                    for (_a = 0, stillActive_1 = stillActive; _a < stillActive_1.length; _a++) {
                        run = stillActive_1[_a];
                        if (!accountLimitsMap.has(run.account_id))
                            accountLimitsMap.set(run.account_id, run);
                    }
                    stillActiveRunIds = stillActive.map(function (r) { return r.run_id; });
                    emailAccountIds = stillActiveRunIds.length > 0
                        ? __spreadArray([], new Set((_k = db.prepare("SELECT DISTINCT rp.email_account_id FROM run_profiles rp\n           WHERE rp.run_id IN (".concat(stillActiveRunIds.map(function () { return "?"; }).join(","), ")\n           AND rp.email_account_id IS NOT NULL"))).all.apply(_k, stillActiveRunIds).map(function (r) { return r.email_account_id; })), true) : [];
                    emailAccountLimitsMap = new Map();
                    for (_b = 0, emailAccountIds_1 = emailAccountIds; _b < emailAccountIds_1.length; _b++) {
                        emailAccountId = emailAccountIds_1[_b];
                        ea = db.prepare("SELECT daily_email_limit, active_hours_start, active_hours_end, timezone, working_days, ramp_up_enabled, ramp_start_date FROM email_accounts WHERE id = ?").get(emailAccountId);
                        if (ea)
                            emailAccountLimitsMap.set(emailAccountId, ea);
                    }
                    connectsSentToday = new Map();
                    messagesSentToday = new Map();
                    inmailsSentToday = new Map();
                    for (_c = 0, accountLimitsMap_1 = accountLimitsMap; _c < accountLimitsMap_1.length; _c++) {
                        accountId = accountLimitsMap_1[_c][0];
                        c = db.prepare("SELECT COUNT(*) as c FROM logs WHERE run_id IN (SELECT id FROM runs WHERE account_id = ?)\n       AND message LIKE 'Connection request sent%' AND date(created_at) = date('now')").get(accountId).c;
                        m = db.prepare("SELECT COUNT(*) as c FROM logs WHERE run_id IN (SELECT id FROM runs WHERE account_id = ?)\n       AND message LIKE 'Message sent%' AND date(created_at) = date('now')").get(accountId).c;
                        im = db.prepare("SELECT COUNT(*) as c FROM logs WHERE run_id IN (SELECT id FROM runs WHERE account_id = ?)\n       AND message LIKE 'InMail sent%' AND date(created_at) = date('now')").get(accountId).c;
                        connectsSentToday.set(accountId, c);
                        messagesSentToday.set(accountId, m);
                        inmailsSentToday.set(accountId, im);
                    }
                    emailsSentToday = new Map();
                    for (_d = 0, emailAccountIds_2 = emailAccountIds; _d < emailAccountIds_2.length; _d++) {
                        emailAccountId = emailAccountIds_2[_d];
                        e = db.prepare("SELECT COUNT(*) as c FROM logs l\n       WHERE l.message LIKE 'Email sent%'\n       AND date(l.created_at) = date('now')\n       AND EXISTS (\n         SELECT 1 FROM run_profiles rp\n         WHERE rp.run_id = l.run_id AND rp.target_id = l.target_id\n         AND rp.email_account_id = ?\n       )").get(emailAccountId).c;
                        emailsSentToday.set(emailAccountId, e);
                    }
                    stepsCache = new Map();
                    getSteps = function (workflowId, track) {
                        var key = "".concat(workflowId, "|").concat(track);
                        if (!stepsCache.has(key)) {
                            stepsCache.set(key, db.prepare("SELECT * FROM workflow_steps WHERE workflow_id = ? AND track = ? ORDER BY step_order").all(workflowId, track));
                        }
                        return stepsCache.get(key);
                    };
                    workflowPromptCache = new Map();
                    getWorkflowPrompt = function (workflowId) {
                        var _a, _b;
                        if (!workflowPromptCache.has(workflowId)) {
                            var row = db.prepare("SELECT prompt FROM workflows WHERE id = ?").get(workflowId);
                            workflowPromptCache.set(workflowId, (_a = row === null || row === void 0 ? void 0 : row.prompt) !== null && _a !== void 0 ? _a : null);
                        }
                        return (_b = workflowPromptCache.get(workflowId)) !== null && _b !== void 0 ? _b : null;
                    };
                    runIds = stillActive.map(function (r) { return r.run_id; });
                    placeholders = runIds.map(function () { return "?"; }).join(",");
                    dueTrackRuns = (_l = db.prepare("SELECT rt.id, rt.run_profile_id, rt.track, rt.state, rt.current_step, rt.next_step_at,\n            rt.error_message, rt.last_email_subject, rt.last_email_body, rt.last_linkedin_message,\n            rt.pending_reply_context,\n            rp.run_id, rp.target_id, rp.email_account_id,\n            r.account_id, r.workflow_id,\n            t.connection_requested_at\n     FROM run_profile_tracks rt\n     JOIN run_profiles rp ON rp.id = rt.run_profile_id\n     JOIN runs r ON r.id = rp.run_id\n     JOIN targets t ON t.id = rp.target_id\n     WHERE rp.run_id IN (".concat(placeholders, ")\n       AND rt.state = 'in_progress'\n       AND (rt.next_step_at IS NULL OR datetime(rt.next_step_at) <= datetime('now'))\n     ORDER BY rt.next_step_at ASC"))).all.apply(_l, runIds);
                    connectSlotsRemaining = new Map();
                    inmailSlotsRemaining = new Map();
                    firstLinkedinStepCache = new Map();
                    getFirstLinkedinStepType = function (workflowId) {
                        if (!firstLinkedinStepCache.has(workflowId)) {
                            var row = db.prepare("SELECT step_type FROM workflow_steps WHERE workflow_id = ? AND track = 'linkedin' ORDER BY step_order LIMIT 1").get(workflowId);
                            firstLinkedinStepCache.set(workflowId, row === null || row === void 0 ? void 0 : row.step_type);
                        }
                        return firstLinkedinStepCache.get(workflowId);
                    };
                    enrolledEmailPairs = new Set();
                    for (_e = 0, stillActive_2 = stillActive; _e < stillActive_2.length; _e++) {
                        run = stillActive_2[_e];
                        limits = accountLimitsMap.get(run.account_id);
                        firstStepType = getFirstLinkedinStepType(run.workflow_id);
                        isInmailFirst = firstStepType === "sales_inmail";
                        slotsRemaining = isInmailFirst ? inmailSlotsRemaining : connectSlotsRemaining;
                        // LinkedIn track enrollment — each run gets its own enrollment, but all runs
                        // for the same account share the daily slot budget for that action type
                        if (!slotsRemaining.has(run.account_id)) {
                            dailyLimit = isInmailFirst ? ((_m = limits.daily_inmail_limit) !== null && _m !== void 0 ? _m : 15) : ((_o = limits.daily_connection_limit) !== null && _o !== void 0 ? _o : 20);
                            sentToday = isInmailFirst
                                ? ((_p = inmailsSentToday.get(run.account_id)) !== null && _p !== void 0 ? _p : 0)
                                : ((_q = connectsSentToday.get(run.account_id)) !== null && _q !== void 0 ? _q : 0);
                            actionsLeft = Math.max(0, dailyLimit - sentToday);
                            firstStepTypeSql = isInmailFirst ? "'sales_inmail'" : "'connect'";
                            scheduledToday = db.prepare("SELECT COUNT(*) as c FROM run_profile_tracks rt\n         JOIN run_profiles rp ON rp.id = rt.run_profile_id\n         JOIN runs r ON r.id = rp.run_id\n         JOIN workflow_steps ws ON ws.workflow_id = r.workflow_id AND ws.track = 'linkedin' AND ws.step_order = 1\n         WHERE r.account_id = ? AND rt.track = 'linkedin' AND rt.state = 'in_progress'\n         AND ws.step_type = ".concat(firstStepTypeSql, "\n         AND date(datetime(rt.next_step_at)) = date('now')")).get(run.account_id).c;
                            slotsRemaining.set(run.account_id, Math.max(0, actionsLeft - scheduledToday));
                        }
                        slotsLeft = slotsRemaining.get(run.account_id);
                        if (slotsLeft > 0) {
                            toEnroll = Math.min(slotsLeft, 5);
                            pending = db.prepare("SELECT rt.id, rt.run_profile_id, rt.track FROM run_profile_tracks rt\n         JOIN run_profiles rp ON rp.id = rt.run_profile_id\n         WHERE rp.run_id = ? AND rt.track = 'linkedin' AND rt.state = 'pending'\n         ORDER BY rt.id LIMIT ?").all(run.run_id, toEnroll);
                            spreadEnrollBatch(db, run.run_id, pending, limits, "linkedin");
                            slotsRemaining.set(run.account_id, slotsLeft - pending.length);
                        }
                        runEmailAccountIds = db.prepare("SELECT DISTINCT rp.email_account_id FROM run_profiles rp\n       WHERE rp.run_id = ? AND rp.email_account_id IS NOT NULL").all(run.run_id).map(function (r) { return r.email_account_id; });
                        for (_f = 0, runEmailAccountIds_1 = runEmailAccountIds; _f < runEmailAccountIds_1.length; _f++) {
                            emailAccId = runEmailAccountIds_1[_f];
                            emailKey = "".concat(run.run_id, "|").concat(emailAccId, "|email");
                            if (!enrolledEmailPairs.has(emailKey)) {
                                enrolledEmailPairs.add(emailKey);
                                emailLimits = emailAccountLimitsMap.get(emailAccId);
                                if (emailLimits) {
                                    effectiveLimit = effectiveEmailLimit(emailLimits);
                                    emailsLeft = Math.max(0, effectiveLimit - ((_r = emailsSentToday.get(emailAccId)) !== null && _r !== void 0 ? _r : 0));
                                    emailScheduledToday = db.prepare("SELECT COUNT(*) as c FROM run_profile_tracks rt\n             JOIN run_profiles rp ON rp.id = rt.run_profile_id\n             WHERE rp.email_account_id = ? AND rt.track = 'email' AND rt.state = 'in_progress'\n             AND date(datetime(rt.next_step_at)) = date('now')").get(emailAccId).c;
                                    emailSlotsLeft = Math.max(0, emailsLeft - emailScheduledToday);
                                    if (emailSlotsLeft > 0) {
                                        pendingEmail = db.prepare("SELECT rt.id, rt.run_profile_id, rt.track FROM run_profile_tracks rt\n               JOIN run_profiles rp ON rp.id = rt.run_profile_id\n               WHERE rp.run_id = ? AND rp.email_account_id = ? AND rt.track = 'email' AND rt.state = 'pending'\n               ORDER BY rt.id LIMIT ?").all(run.run_id, emailAccId, Math.min(emailSlotsLeft, 5));
                                        spreadEnrollBatch(db, run.run_id, pendingEmail, emailLimits, "email");
                                    }
                                }
                            }
                        }
                    }
                    if (dueTrackRuns.length === 0)
                        return [2 /*return*/];
                    toExecute = [];
                    toReschedule = [];
                    connectsPlanned = new Map(Array.from(accountLimitsMap.keys()).map(function (id) { return [id, 0]; }));
                    messagesPlanned = new Map(Array.from(accountLimitsMap.keys()).map(function (id) { return [id, 0]; }));
                    inmailsPlanned = new Map(Array.from(accountLimitsMap.keys()).map(function (id) { return [id, 0]; }));
                    emailsPlanned = new Map(emailAccountIds.map(function (id) { return [id, 0]; }));
                    for (_g = 0, dueTrackRuns_1 = dueTrackRuns; _g < dueTrackRuns_1.length; _g++) {
                        tr = dueTrackRuns_1[_g];
                        steps = getSteps(tr.workflow_id, tr.track);
                        stepIndex = tr.current_step;
                        if (stepIndex >= steps.length) {
                            toExecute.push(tr);
                            continue;
                        }
                        step = steps[stepIndex];
                        limits = accountLimitsMap.get(tr.account_id);
                        if (step.step_type === "connect") {
                            // A connect step is "due" both when it's about to send a NEW request and when
                            // it's just rechecking an already-sent one for acceptance (see the `degree === 1`
                            // check in executeStep). Only the former spends a daily connect slot — the recheck
                            // is a free DB read and must never be blocked by the cap, or an accepted connection
                            // can never hand off to the next step (it'd be rescheduled behind new sends forever).
                            if (tr.connection_requested_at) {
                                toExecute.push(tr);
                                continue;
                            }
                            sentToday = (_s = connectsSentToday.get(tr.account_id)) !== null && _s !== void 0 ? _s : 0;
                            planned = (_t = connectsPlanned.get(tr.account_id)) !== null && _t !== void 0 ? _t : 0;
                            if (sentToday + planned >= ((_u = limits.daily_connection_limit) !== null && _u !== void 0 ? _u : 20)) {
                                toReschedule.push(tr);
                            }
                            else {
                                connectsPlanned.set(tr.account_id, planned + 1);
                                toExecute.push(tr);
                            }
                        }
                        else if (step.step_type === "message") {
                            sentToday = (_v = messagesSentToday.get(tr.account_id)) !== null && _v !== void 0 ? _v : 0;
                            planned = (_w = messagesPlanned.get(tr.account_id)) !== null && _w !== void 0 ? _w : 0;
                            if (sentToday + planned >= ((_x = limits.daily_message_limit) !== null && _x !== void 0 ? _x : 50)) {
                                toReschedule.push(tr);
                            }
                            else {
                                messagesPlanned.set(tr.account_id, planned + 1);
                                toExecute.push(tr);
                            }
                        }
                        else if (step.step_type === "sales_inmail") {
                            sentToday = (_y = inmailsSentToday.get(tr.account_id)) !== null && _y !== void 0 ? _y : 0;
                            planned = (_z = inmailsPlanned.get(tr.account_id)) !== null && _z !== void 0 ? _z : 0;
                            if (inmailCreditsExhaustedToday(tr.account_id) || sentToday + planned >= ((_0 = limits.daily_inmail_limit) !== null && _0 !== void 0 ? _0 : 15)) {
                                toReschedule.push(tr);
                            }
                            else {
                                inmailsPlanned.set(tr.account_id, planned + 1);
                                toExecute.push(tr);
                            }
                        }
                        else if (step.step_type === "email") {
                            profileEmailAccountId = tr.email_account_id;
                            if (!profileEmailAccountId) {
                                toExecute.push(tr);
                            }
                            else {
                                emailLimits = emailAccountLimitsMap.get(profileEmailAccountId);
                                sentToday = (_1 = emailsSentToday.get(profileEmailAccountId)) !== null && _1 !== void 0 ? _1 : 0;
                                planned = (_2 = emailsPlanned.get(profileEmailAccountId)) !== null && _2 !== void 0 ? _2 : 0;
                                effectiveLimit = emailLimits ? effectiveEmailLimit(emailLimits) : 50;
                                if (sentToday + planned >= effectiveLimit) {
                                    toReschedule.push(tr);
                                }
                                else {
                                    emailsPlanned.set(profileEmailAccountId, planned + 1);
                                    toExecute.push(tr);
                                }
                            }
                        }
                        else {
                            // visit, delay — no limit
                            toExecute.push(tr);
                        }
                    }
                    // Reschedule overflow to tomorrow (use LinkedIn account schedule for reschedule)
                    for (_h = 0, toReschedule_1 = toReschedule; _h < toReschedule_1.length; _h++) {
                        tr = toReschedule_1[_h];
                        limits = accountLimitsMap.get(tr.account_id);
                        slot = rescheduleToTomorrow(limits);
                        db.prepare("UPDATE run_profile_tracks SET next_step_at = ? WHERE id = ?").run(slot, tr.id);
                        log(db, tr.run_id, tr.target_id, "info", "Daily limit reached \u2014 rescheduled to ".concat(slot));
                    }
                    _j = 0, toExecute_1 = toExecute;
                    _5.label = 1;
                case 1:
                    if (!(_j < toExecute_1.length)) return [3 /*break*/, 5];
                    tr = toExecute_1[_j];
                    steps = getSteps(tr.workflow_id, tr.track);
                    limits = accountLimitsMap.get(tr.account_id);
                    emailAccountId = (_3 = tr.email_account_id) !== null && _3 !== void 0 ? _3 : null;
                    emailLimits = emailAccountId ? ((_4 = emailAccountLimitsMap.get(emailAccountId)) !== null && _4 !== void 0 ? _4 : null) : null;
                    runStatus = db.prepare("SELECT status FROM runs WHERE id = ?").get(tr.run_id);
                    if (!runStatus || runStatus.status !== "running")
                        return [3 /*break*/, 4];
                    target = db.prepare("SELECT * FROM targets WHERE id = ?").get(tr.target_id);
                    return [4 /*yield*/, executeStep(db, tr.run_id, tr, target, steps, tr.account_id, limits, emailAccountId, emailLimits, getWorkflowPrompt(tr.workflow_id))];
                case 2:
                    _5.sent();
                    return [4 /*yield*/, randomDelay(PROFILE_DELAY_MIN, PROFILE_DELAY_MAX)];
                case 3:
                    _5.sent();
                    _5.label = 4;
                case 4:
                    _j++;
                    return [3 /*break*/, 1];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function spreadEnrollBatch(db, runId, pending, limits, track) {
    var _a, _b, _c, _d;
    var batchSize = pending.length;
    if (batchSize === 0)
        return;
    var start = (_a = limits.active_hours_start) !== null && _a !== void 0 ? _a : 9;
    var end = (_b = limits.active_hours_end) !== null && _b !== void 0 ? _b : 18;
    var _e = getLocalParts(limits.timezone || "UTC"), hour = _e.hour, minute = _e.minute;
    var nowFrac = hour + minute / 60;
    var windowMs = (end - start) * 3600000;
    var bucketMs = windowMs / batchSize;
    var dayStartMs = new Date().setHours(start, 0, 0, 0);
    var _loop_1 = function (i) {
        var row = pending[i];
        var claimed = db.prepare("UPDATE run_profile_tracks SET state = 'in_progress' WHERE id = ? AND state = 'pending'").run(row.id);
        if (claimed.changes === 0)
            return "continue";
        var slot = (function () {
            if (nowFrac >= end - 0.25)
                return rescheduleToTomorrow(limits);
            var bucketStart = dayStartMs + i * bucketMs;
            var bucketEnd = bucketStart + bucketMs;
            return new Date(bucketStart + Math.random() * (bucketEnd - bucketStart)).toISOString();
        })();
        db.prepare("UPDATE run_profile_tracks SET next_step_at = ? WHERE id = ?").run(slot, row.id);
        var tgt = db.prepare("SELECT full_name, linkedin_url FROM targets WHERE id = (SELECT target_id FROM run_profiles WHERE id = ?)").get(row.run_profile_id);
        log(db, runId, null, "info", "[".concat(track, "] Scheduled ").concat((_d = (_c = tgt === null || tgt === void 0 ? void 0 : tgt.full_name) !== null && _c !== void 0 ? _c : tgt === null || tgt === void 0 ? void 0 : tgt.linkedin_url) !== null && _d !== void 0 ? _d : row.run_profile_id, " within active window"));
    };
    for (var i = 0; i < pending.length; i++) {
        _loop_1(i);
    }
}
// ─── public API ──────────────────────────────────────────────────────────────
function startRun(runId) {
    var db = (0, db_1.getDb)();
    db.prepare("UPDATE runs SET status = 'running', started_at = COALESCE(started_at, datetime('now')) WHERE id = ?").run(runId);
    console.log("[runner] Run ".concat(runId, " marked running \u2014 global loop will pick it up"));
}
