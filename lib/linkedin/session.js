"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSessionContext = getSessionContext;
exports.getSessionPage = getSessionPage;
exports.saveSessionState = saveSessionState;
exports.closeSession = closeSession;
exports.markNeedsReauth = markNeedsReauth;
exports.authenticateAccount = authenticateAccount;
exports.startHeadlessLogin = startHeadlessLogin;
exports.submitLoginChallenge = submitLoginChallenge;
exports.awaitLoginApproval = awaitLoginApproval;
var playwright_extra_1 = require("playwright-extra");
var puppeteer_extra_plugin_stealth_1 = require("puppeteer-extra-plugin-stealth");
var db_1 = require("@/lib/db");
var crypto_1 = require("@/lib/crypto");
playwright_extra_1.chromium.use((0, puppeteer_extra_plugin_stealth_1.default)());
var browser = null;
var contexts = new Map();
var HEADLESS = process.env.HEADLESS !== "false";
var CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
var LAUNCH_ARGS = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
];
/**
 * Shared browser-context fingerprint. Login and runtime MUST use the identical
 * options so the LinkedIn session is BORN under the exact fingerprint it will
 * later be used with — a mismatch (or a drift) triggers a forced re-auth.
 */
function contextOptions(storageState) {
    return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        storageState: storageState,
        viewport: { width: 1920, height: 1080 },
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        locale: "en-US",
        timezoneId: "America/New_York",
        permissions: ["clipboard-read", "clipboard-write"],
    };
}
function getBrowser() {
    return __awaiter(this, arguments, void 0, function (headless) {
        var _a;
        if (headless === void 0) { headless = HEADLESS; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!(browser && !browser.isConnected())) return [3 /*break*/, 5];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, browser.close()];
                case 2:
                    _b.sent();
                    return [3 /*break*/, 4];
                case 3:
                    _a = _b.sent();
                    return [3 /*break*/, 4];
                case 4:
                    browser = null;
                    _b.label = 5;
                case 5:
                    if (!!browser) return [3 /*break*/, 7];
                    return [4 /*yield*/, playwright_extra_1.chromium.launch({
                            headless: headless,
                            executablePath: CHROMIUM_PATH,
                            args: LAUNCH_ARGS,
                        })];
                case 6:
                    browser = _b.sent();
                    _b.label = 7;
                case 7: return [2 /*return*/, browser];
            }
        });
    });
}
function getOrCreateContext(accountId) {
    return __awaiter(this, void 0, void 0, function () {
        var db, account, b, storageState, ctx_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    db = (0, db_1.getDb)();
                    account = db.prepare("SELECT * FROM accounts WHERE id = ?").get(accountId);
                    if (!account)
                        throw new Error("Account ".concat(accountId, " not found"));
                    if (!!contexts.has(accountId)) return [3 /*break*/, 3];
                    return [4 /*yield*/, getBrowser()];
                case 1:
                    b = _a.sent();
                    storageState = void 0;
                    if (account.cookies_json) {
                        try {
                            storageState = JSON.parse((0, crypto_1.decryptSecret)(account.cookies_json));
                        }
                        catch (_b) {
                            // Invalid storage state — will need re-auth
                        }
                    }
                    return [4 /*yield*/, b.newContext(contextOptions(storageState))];
                case 2:
                    ctx_1 = _a.sent();
                    // Auto-evict from map when context closes for any reason (crash, session expiry, etc.)
                    ctx_1.on("close", function () { if (contexts.get(accountId) === ctx_1)
                        contexts.delete(accountId); });
                    contexts.set(accountId, ctx_1);
                    _a.label = 3;
                case 3: return [2 /*return*/, contexts.get(accountId)];
            }
        });
    });
}
/** Returns the BrowserContext for an account (for API calls via ctx.request) */
function getSessionContext(accountId) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, getOrCreateContext(accountId)];
                case 1: return [2 /*return*/, _b.sent()];
                case 2:
                    _a = _b.sent();
                    // First attempt failed — evict and retry once with a fresh context
                    contexts.delete(accountId);
                    return [2 /*return*/, getOrCreateContext(accountId)];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// B6 (Jul 2026 CPU-spike incident): closing a Playwright page doesn't mean the
// underlying Chromium renderer OS process has actually exited — under CPU
// contention on the 2-vCPU prod box, teardown was observed lagging 60-90s
// behind page.close(). If the runner loop (or a concurrent MCP/API call)
// opens its next page immediately after, two renderer processes end up alive
// at once, which is enough to peg both cores and starve sibling containers'
// healthchecks (NocoDB/Chatwoot flapping). Fix: serialize ALL page opens
// app-wide through one queue, and hold the queue for a teardown buffer after
// each page.close() before letting the next one through. PAGE_MAX_HOLD_MS is
// a safety valve so a caller that forgets to close its page can't wedge the
// whole app's browser access forever.
var PAGE_TEARDOWN_GAP_MS = 3000;
var PAGE_MAX_HOLD_MS = 120000;
var pageQueueTail = Promise.resolve();
/** Returns a new Page from the account's browser context */
function getSessionPage(accountId) {
    return __awaiter(this, void 0, void 0, function () {
        var releaseTurn, myTurn, previousTail, released, release, safetyTimer, page, ctx, _a, _b, freshCtx, err_1, originalClose;
        var _this = this;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    myTurn = new Promise(function (r) { releaseTurn = r; });
                    previousTail = pageQueueTail;
                    pageQueueTail = myTurn;
                    return [4 /*yield*/, previousTail];
                case 1:
                    _c.sent();
                    released = false;
                    release = function () {
                        if (released)
                            return;
                        released = true;
                        releaseTurn();
                    };
                    safetyTimer = setTimeout(release, PAGE_MAX_HOLD_MS);
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, 14, , 15]);
                    return [4 /*yield*/, getOrCreateContext(accountId)];
                case 3:
                    ctx = _c.sent();
                    _c.label = 4;
                case 4:
                    _c.trys.push([4, 6, , 13]);
                    return [4 /*yield*/, ctx.newPage()];
                case 5:
                    page = _c.sent();
                    return [3 /*break*/, 13];
                case 6:
                    _a = _c.sent();
                    _c.label = 7;
                case 7:
                    _c.trys.push([7, 9, , 10]);
                    return [4 /*yield*/, ctx.close()];
                case 8:
                    _c.sent();
                    return [3 /*break*/, 10];
                case 9:
                    _b = _c.sent();
                    return [3 /*break*/, 10];
                case 10:
                    contexts.delete(accountId);
                    return [4 /*yield*/, getOrCreateContext(accountId)];
                case 11:
                    freshCtx = _c.sent();
                    return [4 /*yield*/, freshCtx.newPage()];
                case 12:
                    page = _c.sent();
                    return [3 /*break*/, 13];
                case 13: return [3 /*break*/, 15];
                case 14:
                    err_1 = _c.sent();
                    clearTimeout(safetyTimer);
                    release();
                    throw err_1;
                case 15:
                    originalClose = page.close.bind(page);
                    page.close = (function (options) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, , 2, 3]);
                                    return [4 /*yield*/, originalClose(options)];
                                case 1: return [2 /*return*/, _a.sent()];
                                case 2:
                                    clearTimeout(safetyTimer);
                                    setTimeout(release, PAGE_TEARDOWN_GAP_MS);
                                    return [7 /*endfinally*/];
                                case 3: return [2 /*return*/];
                            }
                        });
                    }); });
                    return [2 /*return*/, page];
            }
        });
    });
}
function saveSessionState(accountId) {
    return __awaiter(this, void 0, void 0, function () {
        var ctx, db, state;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ctx = contexts.get(accountId);
                    if (!ctx)
                        return [2 /*return*/];
                    db = (0, db_1.getDb)();
                    return [4 /*yield*/, ctx.storageState()];
                case 1:
                    state = _a.sent();
                    db.prepare("UPDATE accounts SET cookies_json = ?, is_authenticated = 1 WHERE id = ?").run((0, crypto_1.encryptSecret)(JSON.stringify(state)), accountId);
                    return [2 /*return*/];
            }
        });
    });
}
function closeSession(accountId) {
    return __awaiter(this, void 0, void 0, function () {
        var ctx;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ctx = contexts.get(accountId);
                    if (!ctx) return [3 /*break*/, 2];
                    return [4 /*yield*/, ctx.close()];
                case 1:
                    _a.sent();
                    contexts.delete(accountId);
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    });
}
/**
 * B4: flag an account as logged out / needing re-auth. Clears is_authenticated
 * so the runner stops working a dead session (no more 30s-timeout fail-loop),
 * and drops the live context. The user re-authenticates from Settings.
 */
function markNeedsReauth(accountId) {
    return __awaiter(this, void 0, void 0, function () {
        var db, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    db = (0, db_1.getDb)();
                    db.prepare("UPDATE accounts SET is_authenticated = 0 WHERE id = ?").run(accountId);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, closeSession(accountId)];
                case 2:
                    _b.sent();
                    return [3 /*break*/, 4];
                case 3:
                    _a = _b.sent();
                    return [3 /*break*/, 4];
                case 4:
                    console.warn("[session] account ".concat(accountId, " flagged needs-reauth (session logged out)"));
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Opens a visible browser, navigates to LinkedIn login, and waits for the user
 * to complete login manually. Returns when the user reaches /feed.
 * Saves the full storage state to DB and marks account as authenticated.
 */
function authenticateAccount(accountId) {
    return __awaiter(this, void 0, void 0, function () {
        var db, account, visibleBrowser, ctx, page, _a, state;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    db = (0, db_1.getDb)();
                    account = db.prepare("SELECT * FROM accounts WHERE id = ?").get(accountId);
                    if (!account)
                        throw new Error("Account ".concat(accountId, " not found"));
                    // Close any existing context for this account — start fresh
                    return [4 /*yield*/, closeSession(accountId)];
                case 1:
                    // Close any existing context for this account — start fresh
                    _b.sent();
                    return [4 /*yield*/, playwright_extra_1.chromium.launch({
                            headless: false,
                            executablePath: CHROMIUM_PATH,
                            args: [
                                "--no-sandbox",
                                "--disable-setuid-sandbox",
                                "--disable-dev-shm-usage",
                                "--disable-gpu",
                            ],
                        })];
                case 2:
                    visibleBrowser = _b.sent();
                    _b.label = 3;
                case 3:
                    _b.trys.push([3, , 15, 17]);
                    return [4 /*yield*/, visibleBrowser.newContext({
                            viewport: { width: 1440, height: 900 },
                            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                            locale: "en-US",
                            timezoneId: "America/New_York",
                        })];
                case 4:
                    ctx = _b.sent();
                    return [4 /*yield*/, ctx.newPage()];
                case 5:
                    page = _b.sent();
                    return [4 /*yield*/, page.goto("https://www.linkedin.com/login")];
                case 6:
                    _b.sent();
                    _b.label = 7;
                case 7:
                    _b.trys.push([7, 10, , 11]);
                    return [4 /*yield*/, page.waitForSelector("input#username", { timeout: 5000 })];
                case 8:
                    _b.sent();
                    return [4 /*yield*/, page.fill("input#username", account.email)];
                case 9:
                    _b.sent();
                    return [3 /*break*/, 11];
                case 10:
                    _a = _b.sent();
                    return [3 /*break*/, 11];
                case 11: 
                // Wait up to 3 minutes for the user to complete login and reach /feed
                return [4 /*yield*/, page.waitForURL("**/feed/**", { timeout: 180000 })];
                case 12:
                    // Wait up to 3 minutes for the user to complete login and reach /feed
                    _b.sent();
                    return [4 /*yield*/, ctx.storageState()];
                case 13:
                    state = _b.sent();
                    db.prepare("UPDATE accounts SET cookies_json = ?, is_authenticated = 1 WHERE id = ?").run((0, crypto_1.encryptSecret)(JSON.stringify(state)), accountId);
                    return [4 /*yield*/, ctx.close()];
                case 14:
                    _b.sent();
                    return [3 /*break*/, 17];
                case 15: return [4 /*yield*/, visibleBrowser.close()];
                case 16:
                    _b.sent();
                    return [7 /*endfinally*/];
                case 17: return [2 /*return*/];
            }
        });
    });
}
var pendingLogins = new Map();
var PENDING_TTL_MS = 10 * 60000;
// PIN/verification-code input. Named ids first, then type-based fallbacks for
// LinkedIn's React checkpoint pages (which use dynamic ids). Safe: the login
// page itself has no tel/one-time-code input to misfire on.
var PIN_SELECTOR = "input[name='pin'], #input__email_verification_pin, input[autocomplete='one-time-code']:visible, input[type='tel']:visible";
function clearPendingLogin(accountId) {
    return __awaiter(this, void 0, void 0, function () {
        var p, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    p = pendingLogins.get(accountId);
                    if (!p) return [3 /*break*/, 4];
                    pendingLogins.delete(accountId);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, p.ctx.close()];
                case 2:
                    _b.sent();
                    return [3 /*break*/, 4];
                case 3:
                    _a = _b.sent();
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function sweepPendingLogins() {
    var now = Date.now();
    for (var _i = 0, pendingLogins_1 = pendingLogins; _i < pendingLogins_1.length; _i++) {
        var _a = pendingLogins_1[_i], id = _a[0], p = _a[1];
        if (now - p.createdAt > PENDING_TTL_MS)
            void clearPendingLogin(id);
    }
}
/**
 * Warm the freshly-authenticated session by loading Sales Navigator once, THEN
 * persist. The bare login POST lands on /feed and only mints the ~11 core
 * LinkedIn cookies — it does NOT yet include the Sales Nav SEAT cookie
 * (li_ep_auth_context) nor the secondary auth tokens (li_a, liap) and
 * localStorage. Those are only issued once the browser actually enters Sales
 * Navigator. Without the seat cookie every Sales Nav API call returns nothing
 * ("no intercept after 15s" → import fails → account wrongly flagged
 * needs-reauth). So we navigate to /sales/ and wait for it to settle before
 * calling storageState(), capturing the FULL session the runner needs.
 * Best-effort: if the account has no Sales Nav seat the nav simply doesn't add
 * the seat cookie — the rest of the (regular-LinkedIn) session is still saved.
 */
function persistLogin(accountId, ctx, page) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, db, state;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!page) return [3 /*break*/, 5];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, page.goto("https://www.linkedin.com/sales/home", { waitUntil: "domcontentloaded", timeout: 30000 })];
                case 2:
                    _b.sent();
                    // Let Sales Nav's bootstrap requests fire so li_ep_auth_context is set.
                    return [4 /*yield*/, page.waitForTimeout(4000)];
                case 3:
                    // Let Sales Nav's bootstrap requests fire so li_ep_auth_context is set.
                    _b.sent();
                    return [3 /*break*/, 5];
                case 4:
                    _a = _b.sent();
                    return [3 /*break*/, 5];
                case 5:
                    db = (0, db_1.getDb)();
                    return [4 /*yield*/, ctx.storageState()];
                case 6:
                    state = _b.sent();
                    db.prepare("UPDATE accounts SET cookies_json = ?, is_authenticated = 1 WHERE id = ?").run((0, crypto_1.encryptSecret)(JSON.stringify(state)), accountId);
                    // Drop any stale runtime context so the runner reloads the fresh cookies.
                    return [4 /*yield*/, closeSession(accountId)];
                case 7:
                    // Drop any stale runtime context so the runner reloads the fresh cookies.
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
/**
 * Inspect the page after a login/verify submit and classify the outcome.
 * LinkedIn varies its challenge per attempt — email/SMS code OR device (app)
 * approval — so we detect both: a visible code input = otp; a checkpoint page
 * with no code input and no captcha = device approval.
 */
function classifyLoginState(page) {
    return __awaiter(this, void 0, void 0, function () {
        var start, deadline, url, pin, _a, cap, wrongPw;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    start = Date.now();
                    deadline = start + 20000;
                    _b.label = 1;
                case 1:
                    if (!(Date.now() < deadline)) return [3 /*break*/, 9];
                    url = page.url();
                    if (/\/feed\//.test(url) || /linkedin\.com\/sales\//.test(url)) {
                        return [2 /*return*/, { status: "authenticated" }];
                    }
                    pin = page.locator(PIN_SELECTOR).first();
                    return [4 /*yield*/, pin.count()];
                case 2:
                    _a = (_b.sent()) > 0;
                    if (!_a) return [3 /*break*/, 4];
                    return [4 /*yield*/, pin.isVisible().catch(function () { return false; })];
                case 3:
                    _a = (_b.sent());
                    _b.label = 4;
                case 4:
                    if (_a) {
                        return [2 /*return*/, {
                                status: "challenge",
                                kind: "otp",
                                message: "LinkedIn sent you a verification code (email or SMS). Enter it below.",
                            }];
                    }
                    if (!/checkpoint\/challenge/.test(url)) return [3 /*break*/, 6];
                    cap = page.locator("iframe[src*='arkoselabs'], iframe[title*='captcha'], #captcha-internal");
                    return [4 /*yield*/, cap.count().catch(function () { return 0; })];
                case 5:
                    if ((_b.sent()) > 0) {
                        return [2 /*return*/, {
                                status: "challenge",
                                kind: "captcha",
                                message: "LinkedIn requires a CAPTCHA, which can't be solved on the server. Use cookie paste instead.",
                            }];
                    }
                    // Device/app approval: a settled checkpoint with no code input and no captcha
                    if (Date.now() - start > 4000) {
                        return [2 /*return*/, {
                                status: "challenge",
                                kind: "app",
                                message: "LinkedIn sent a sign-in request to your LinkedIn mobile app. Approve it there, then click Continue.",
                            }];
                    }
                    _b.label = 6;
                case 6: return [4 /*yield*/, page
                        .getByText(/that.?s not the right password|please enter a valid|couldn.?t find a linkedin account/i)
                        .count()
                        .catch(function () { return 0; })];
                case 7:
                    wrongPw = _b.sent();
                    if (wrongPw > 0)
                        return [2 /*return*/, { status: "error", message: "Wrong email or password." }];
                    return [4 /*yield*/, page.waitForTimeout(800)];
                case 8:
                    _b.sent();
                    return [3 /*break*/, 1];
                case 9:
                    if (/checkpoint/.test(page.url())) {
                        return [2 /*return*/, {
                                status: "challenge",
                                kind: "unknown",
                                message: "LinkedIn presented a security checkpoint. If you got a code enter it; if it's an app request, approve it and click Continue.",
                            }];
                    }
                    return [2 /*return*/, { status: "error", message: "Login did not complete. Current page: ".concat(page.url()) }];
            }
        });
    });
}
function startHeadlessLogin(accountId, email, password) {
    return __awaiter(this, void 0, void 0, function () {
        var b, ctx, page, emailInput, passwordInput, result, e_1, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    sweepPendingLogins();
                    return [4 /*yield*/, clearPendingLogin(accountId)];
                case 1:
                    _b.sent();
                    return [4 /*yield*/, getBrowser(true)];
                case 2:
                    b = _b.sent();
                    return [4 /*yield*/, b.newContext(contextOptions())];
                case 3:
                    ctx = _b.sent();
                    return [4 /*yield*/, ctx.newPage()];
                case 4:
                    page = _b.sent();
                    _b.label = 5;
                case 5:
                    _b.trys.push([5, 16, , 21]);
                    return [4 /*yield*/, page.goto("https://www.linkedin.com/login", { waitUntil: "domcontentloaded", timeout: 30000 })];
                case 6:
                    _b.sent();
                    emailInput = page.locator("input#username, input[type='email']:visible").first();
                    return [4 /*yield*/, emailInput.waitFor({ state: "visible", timeout: 20000 })];
                case 7:
                    _b.sent();
                    return [4 /*yield*/, emailInput.fill(email)];
                case 8:
                    _b.sent();
                    passwordInput = page.locator("input#password, input[type='password']:visible").first();
                    return [4 /*yield*/, passwordInput.fill(password)];
                case 9:
                    _b.sent();
                    return [4 /*yield*/, Promise.all([
                            page.waitForLoadState("domcontentloaded").catch(function () { }),
                            passwordInput.press("Enter"),
                        ])];
                case 10:
                    _b.sent();
                    return [4 /*yield*/, classifyLoginState(page)];
                case 11:
                    result = _b.sent();
                    console.log("[login] start account=".concat(accountId, " -> ").concat(result.status).concat("kind" in result ? "/" + result.kind : "", " url=").concat(page.url()));
                    if (!(result.status === "authenticated")) return [3 /*break*/, 14];
                    return [4 /*yield*/, persistLogin(accountId, ctx, page)];
                case 12:
                    _b.sent();
                    return [4 /*yield*/, ctx.close()];
                case 13:
                    _b.sent();
                    return [2 /*return*/, result];
                case 14:
                    if (result.status === "challenge" && result.kind !== "captcha") {
                        pendingLogins.set(accountId, { ctx: ctx, page: page, createdAt: Date.now() });
                        return [2 /*return*/, result];
                    }
                    return [4 /*yield*/, ctx.close()];
                case 15:
                    _b.sent();
                    return [2 /*return*/, result];
                case 16:
                    e_1 = _b.sent();
                    console.log("[login] start account=".concat(accountId, " ERROR ").concat(e_1.message, " url=").concat(page.url()));
                    _b.label = 17;
                case 17:
                    _b.trys.push([17, 19, , 20]);
                    return [4 /*yield*/, ctx.close()];
                case 18:
                    _b.sent();
                    return [3 /*break*/, 20];
                case 19:
                    _a = _b.sent();
                    return [3 /*break*/, 20];
                case 20: return [2 /*return*/, { status: "error", message: e_1.message }];
                case 21: return [2 /*return*/];
            }
        });
    });
}
function submitLoginChallenge(accountId, code) {
    return __awaiter(this, void 0, void 0, function () {
        var p, ctx, page, pin, result, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    p = pendingLogins.get(accountId);
                    if (!p)
                        return [2 /*return*/, { status: "error", message: "No login in progress (it may have timed out — start again)." }];
                    ctx = p.ctx, page = p.page;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 10, , 12]);
                    pin = page.locator(PIN_SELECTOR).first();
                    return [4 /*yield*/, pin.waitFor({ state: "visible", timeout: 15000 })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, pin.fill(code)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, Promise.all([
                            page.waitForLoadState("domcontentloaded").catch(function () { }),
                            pin.press("Enter"),
                        ])];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, classifyLoginState(page)];
                case 5:
                    result = _a.sent();
                    console.log("[login] verify account=".concat(accountId, " -> ").concat(result.status).concat("kind" in result ? "/" + result.kind : "", " url=").concat(page.url()));
                    if (!(result.status === "authenticated")) return [3 /*break*/, 8];
                    return [4 /*yield*/, persistLogin(accountId, ctx, page)];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, clearPendingLogin(accountId)];
                case 7:
                    _a.sent();
                    return [2 /*return*/, result];
                case 8:
                    if (result.status === "challenge" && result.kind !== "captcha") {
                        p.createdAt = Date.now(); // keep the session alive for another step
                        return [2 /*return*/, result];
                    }
                    return [4 /*yield*/, clearPendingLogin(accountId)];
                case 9:
                    _a.sent();
                    return [2 /*return*/, result.status === "error"
                            ? result
                            : { status: "error", message: "Code rejected or login failed." }];
                case 10:
                    e_2 = _a.sent();
                    return [4 /*yield*/, clearPendingLogin(accountId)];
                case 11:
                    _a.sent();
                    return [2 /*return*/, { status: "error", message: e_2.message }];
                case 12: return [2 /*return*/];
            }
        });
    });
}
/**
 * Wait for a device/app-approval challenge to clear. Called after the user
 * approves the sign-in in their LinkedIn mobile app — the checkpoint page then
 * auto-advances to the feed. Also dismisses a possible "remember this browser?"
 * interstitial. If still pending, returns the challenge so the user can retry.
 */
function awaitLoginApproval(accountId) {
    return __awaiter(this, void 0, void 0, function () {
        var p, ctx, page, reachedFeed, btn, result, e_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    p = pendingLogins.get(accountId);
                    if (!p)
                        return [2 /*return*/, { status: "error", message: "No login in progress (it may have timed out — start again)." }];
                    ctx = p.ctx, page = p.page;
                    p.createdAt = Date.now();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 12, , 14]);
                    return [4 /*yield*/, page
                            .waitForURL(/\/feed\/|linkedin\.com\/sales\//, { timeout: 50000 })
                            .then(function () { return true; })
                            .catch(function () { return false; })];
                case 2:
                    reachedFeed = _a.sent();
                    if (!!reachedFeed) return [3 /*break*/, 6];
                    btn = page
                        .locator("button[type=submit]:visible, button:has-text('Yes'):visible, button:has-text('Ja'):visible")
                        .first();
                    return [4 /*yield*/, btn.count().catch(function () { return 0; })];
                case 3:
                    if (!((_a.sent()) > 0)) return [3 /*break*/, 6];
                    return [4 /*yield*/, btn.click().catch(function () { })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, page.waitForURL(/\/feed\/|linkedin\.com\/sales\//, { timeout: 20000 }).catch(function () { })];
                case 5:
                    _a.sent();
                    _a.label = 6;
                case 6: return [4 /*yield*/, classifyLoginState(page)];
                case 7:
                    result = _a.sent();
                    console.log("[login] await account=".concat(accountId, " -> ").concat(result.status).concat("kind" in result ? "/" + result.kind : "", " url=").concat(page.url()));
                    if (!(result.status === "authenticated")) return [3 /*break*/, 10];
                    return [4 /*yield*/, persistLogin(accountId, ctx, page)];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, clearPendingLogin(accountId)];
                case 9:
                    _a.sent();
                    return [2 /*return*/, result];
                case 10:
                    if (result.status === "challenge" && result.kind !== "captcha") {
                        p.createdAt = Date.now();
                        return [2 /*return*/, result];
                    }
                    return [4 /*yield*/, clearPendingLogin(accountId)];
                case 11:
                    _a.sent();
                    return [2 /*return*/, result];
                case 12:
                    e_3 = _a.sent();
                    return [4 /*yield*/, clearPendingLogin(accountId)];
                case 13:
                    _a.sent();
                    return [2 /*return*/, { status: "error", message: e_3.message }];
                case 14: return [2 /*return*/];
            }
        });
    });
}
