"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.LinkedInInboxAuthenticationError = exports.LinkedInInboxAccountError = void 0;
exports.captureLinkedInInboxObservations = captureLinkedInInboxObservations;
exports.isLinkedInAuthenticationWall = isLinkedInAuthenticationWall;
exports.syncLinkedInInboxReadOnly = syncLinkedInInboxReadOnly;
var sdr_shim_1 = require("./sdr-shim");
var node_crypto_1 = require("node:crypto");
function getDefaultDb() {
    // Keep database and browser initialization lazy so pure capture fixtures can
    // run against an injected SQLite connection without Linki process startup.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("../db").getDb();
}
function getSessionRuntime() {
    // Keep the browser dependency lazy: pure normalization/capture tests must not
    // initialize Playwright or a Linki session.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./session");
}
var ADAPTER_VERSION = "2a-contract";
var MAX_EVENT_ID_LENGTH = 512;
var LINKEDIN_PROFILE_HOSTS = new Set(["linkedin.com", "www.linkedin.com"]);
var FSD_PROFILE_URN = /^urn:li:fsd_profile:[^\s]+$/;
var AUTH_WALL_PATTERN = /\/login|\/authwall|\/checkpoint|\/uas\//i;
var LinkedInInboxAccountError = /** @class */ (function (_super) {
    __extends(LinkedInInboxAccountError, _super);
    function LinkedInInboxAccountError(message, reason) {
        var _this = _super.call(this, message) || this;
        _this.reason = reason;
        _this.name = "LinkedInInboxAccountError";
        return _this;
    }
    return LinkedInInboxAccountError;
}(Error));
exports.LinkedInInboxAccountError = LinkedInInboxAccountError;
var LinkedInInboxAuthenticationError = /** @class */ (function (_super) {
    __extends(LinkedInInboxAuthenticationError, _super);
    function LinkedInInboxAuthenticationError(url) {
        var _this = _super.call(this, "LinkedIn session requires re-authentication") || this;
        _this.url = url;
        _this.name = "LinkedInInboxAuthenticationError";
        return _this;
    }
    return LinkedInInboxAuthenticationError;
}(Error));
exports.LinkedInInboxAuthenticationError = LinkedInInboxAuthenticationError;
function trimNullable(value) {
    if (typeof value !== "string")
        return null;
    var trimmed = value.trim();
    return trimmed || null;
}
function normalizeBody(value) {
    if (typeof value !== "string")
        return null;
    var body = value.replace(/\r\n?/g, "\n").trim();
    return body || null;
}
function normalizeReceivedAt(value) {
    // Epoch timestamps are intentionally not accepted until a real LinkedIn
    // fixture proves that format. Date-only and timezone-less values are also
    // ambiguous and must not enter the conversation timeline.
    if (typeof value !== "string")
        return null;
    var input = value.trim();
    var match = input.match(/^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d+)?(Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d)$/);
    if (!match)
        return null;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (day < 1 || day > daysInMonth)
        return null;
    var date = new Date(input);
    if (Number.isNaN(date.getTime()))
        return null;
    return date.toISOString();
}
function normalizeProfileVanity(value) {
    var input = trimNullable(value);
    if (!input)
        return null;
    var url;
    try {
        url = new URL(input);
    }
    catch (_a) {
        return null;
    }
    if (url.protocol !== "https:"
        || !LINKEDIN_PROFILE_HOSTS.has(url.hostname.toLowerCase())
        || url.port
        || url.username
        || url.password)
        return null;
    var parts = url.pathname.split("/").filter(Boolean);
    if (parts.length !== 2 || parts[0].toLowerCase() !== "in")
        return null;
    try {
        var vanity = decodeURIComponent(parts[1]).trim().toLowerCase();
        return vanity && /^[^\s/?#]+$/.test(vanity) ? vanity : null;
    }
    catch (_b) {
        return null;
    }
}
function normalizeTargetVanity(value) {
    return normalizeProfileVanity(value);
}
function isValidMessagingUrn(value) {
    return FSD_PROFILE_URN.test(value);
}
function observationKey(observation) {
    if (!observation || typeof observation !== "object")
        return {};
    var value = observation;
    return {
        externalThreadId: typeof value.externalThreadId === "string"
            ? value.externalThreadId.trim().slice(0, 1024) || undefined
            : undefined,
        externalMessageId: typeof value.externalMessageId === "string"
            ? value.externalMessageId.trim().slice(0, 1024) || undefined
            : undefined,
    };
}
function normalizeObservation(value) {
    if (!value || typeof value !== "object")
        return { reason: "invalid_observation" };
    var observation = value;
    if (observation.direction !== "inbound") {
        return {
            reason: observation.direction === "outbound" || observation.direction === "system"
                ? "outbound_or_system"
                : "invalid_observation",
        };
    }
    var externalThreadId = trimNullable(observation.externalThreadId);
    var externalMessageId = trimNullable(observation.externalMessageId);
    var body = normalizeBody(observation.body);
    var receivedAt = normalizeReceivedAt(observation.receivedAt);
    if (!externalThreadId || !externalMessageId || !body || !receivedAt) {
        return { reason: "invalid_observation" };
    }
    if (externalThreadId.length > 1024 || externalMessageId.length > 1024 || body.length > 100000) {
        return { reason: "invalid_observation" };
    }
    var senderMessagingUrn = trimNullable(observation.senderMessagingUrn);
    if (senderMessagingUrn && !isValidMessagingUrn(senderMessagingUrn)) {
        return { reason: "invalid_identity" };
    }
    var profileInput = trimNullable(observation.senderProfileUrl);
    var senderVanity = profileInput ? normalizeProfileVanity(profileInput) : null;
    if (profileInput && !senderVanity)
        return { reason: "invalid_identity" };
    if (!senderMessagingUrn && !senderVanity)
        return { reason: "invalid_identity" };
    var senderExternalId = trimNullable(observation.senderExternalId);
    var senderName = trimNullable(observation.senderName);
    if (senderExternalId && senderExternalId.length > 1024)
        return { reason: "invalid_observation" };
    if (senderName && senderName.length > 500)
        return { reason: "invalid_observation" };
    return {
        observation: observation,
        externalThreadId: externalThreadId,
        externalMessageId: externalMessageId,
        body: body,
        receivedAt: receivedAt,
        senderExternalId: senderExternalId,
        senderName: senderName,
        senderMessagingUrn: senderMessagingUrn,
        senderVanity: senderVanity,
    };
}
function accountIsReady(db, accountId) {
    if (!accountId.trim()) {
        throw new LinkedInInboxAccountError("LinkedIn account id cannot be empty", "unknown_account");
    }
    var account = db.prepare("SELECT id, is_authenticated FROM accounts WHERE id = ?").get(accountId);
    if (!account)
        throw new LinkedInInboxAccountError("LinkedIn account ".concat(accountId, " not found"), "unknown_account");
    if (account.is_authenticated !== 1) {
        throw new LinkedInInboxAccountError("LinkedIn account ".concat(accountId, " is not authenticated"), "unauthenticated_account");
    }
}
function loadScopedTargets(db, accountId) {
    return db.prepare("\n    SELECT DISTINCT t.id, t.messaging_urn, t.linkedin_url\n    FROM targets t\n    JOIN run_profiles rp ON rp.target_id = t.id\n    JOIN runs r ON r.id = rp.run_id\n    WHERE r.account_id = ?\n  ").all(accountId);
}
function loadAllTargets(db) {
    return db.prepare("SELECT id, messaging_urn, linkedin_url FROM targets").all();
}
function idsForMessagingUrn(targets, urn) {
    return __spreadArray([], new Set(targets.filter(function (target) { return target.messaging_urn === urn; }).map(function (target) { return target.id; })), true);
}
function idsForVanity(targets, vanity) {
    return __spreadArray([], new Set(targets.filter(function (target) { return normalizeTargetVanity(target.linkedin_url) === vanity; }).map(function (target) { return target.id; })), true);
}
function resolveTarget(db, accountId, normalized, scoped, allTargets) {
    var urnIds = normalized.senderMessagingUrn ? idsForMessagingUrn(scoped, normalized.senderMessagingUrn) : [];
    var vanityIds = normalized.senderVanity ? idsForVanity(scoped, normalized.senderVanity) : [];
    var globalUrnIds = normalized.senderMessagingUrn ? idsForMessagingUrn(allTargets, normalized.senderMessagingUrn) : [];
    var globalVanityIds = normalized.senderVanity ? idsForVanity(allTargets, normalized.senderVanity) : [];
    if (normalized.senderMessagingUrn && normalized.senderVanity) {
        if (urnIds.length > 1 || vanityIds.length > 1)
            return { reason: "ambiguous_target" };
        if (urnIds.length === 1 && vanityIds.length === 1 && urnIds[0] !== vanityIds[0]) {
            return { reason: "identity_conflict" };
        }
        if (urnIds.length === 1 && vanityIds.length === 0) {
            return globalVanityIds.length > 0 ? { reason: "identity_conflict" } : { reason: "unmatched_target" };
        }
        if (urnIds.length === 0 && vanityIds.length === 1) {
            return globalUrnIds.length > 0 ? { reason: "identity_conflict" } : { reason: "unmatched_target" };
        }
        if (urnIds.length === 0 || vanityIds.length === 0) {
            return globalUrnIds.length > 0 || globalVanityIds.length > 0
                ? { reason: "wrong_account_ownership" }
                : { reason: "unmatched_target" };
        }
        return { targetId: urnIds[0], identityMode: "messaging_urn+profile_url" };
    }
    if (normalized.senderMessagingUrn) {
        if (urnIds.length > 1)
            return { reason: "ambiguous_target" };
        if (urnIds.length === 1)
            return { targetId: urnIds[0], identityMode: "messaging_urn" };
        if (globalUrnIds.length > 0)
            return { reason: "wrong_account_ownership" };
        return { reason: "unmatched_target" };
    }
    if (vanityIds.length > 1)
        return { reason: "ambiguous_target" };
    if (vanityIds.length === 1)
        return { targetId: vanityIds[0], identityMode: "profile_url" };
    if (globalVanityIds.length > 0)
        return { reason: "wrong_account_ownership" };
    return { reason: "unmatched_target" };
}
function safeMetadata(normalized, identityMode) {
    var metadata = {
        adapter_version: ADAPTER_VERSION,
        identity_mode: identityMode,
    };
    var rawKind = trimNullable(normalized.observation.rawKind);
    if (rawKind && rawKind.length <= 100 && /^[\w.:-]+$/.test(rawKind))
        metadata.raw_kind = rawKind;
    return metadata;
}
function boundedEventId(accountId, threadId, messageId, providerEventId) {
    var candidate = "linkedin:".concat(accountId, ":").concat(threadId, ":").concat(messageId);
    if (candidate.length <= MAX_EVENT_ID_LENGTH)
        return candidate;
    var digest = (0, node_crypto_1.createHash)("sha256").update(candidate, "utf8").digest("hex");
    return "linkedin:event:".concat(digest);
}
function toSdrEvent(accountId, targetId, normalized, identityMode) {
    var providerEventId = trimNullable(normalized.observation.providerEventId);
    var eventId = boundedEventId(accountId, normalized.externalThreadId, normalized.externalMessageId, providerEventId);
    return {
        eventId: eventId,
        channel: "linkedin",
        targetId: targetId,
        accountId: accountId,
        emailAccountId: null,
        externalThreadId: normalized.externalThreadId,
        externalMessageId: normalized.externalMessageId,
        senderExternalId: normalized.senderExternalId,
        senderName: normalized.senderName,
        body: normalized.body,
        receivedAt: normalized.receivedAt,
        metadata: safeMetadata(normalized, identityMode),
    };
}
function repositoryErrorReason(error) {
    if (error instanceof Error && /different target|target/i.test(error.message))
        return "identity_conflict";
    return "invalid_observation";
}
/**
 * Normalizes and captures observed inbound records for one explicit LinkedIn
 * slot. No target or legacy inbox state is inferred or updated here.
 */
function captureLinkedInInboxObservations(db, accountId, observations) {
    accountIsReady(db, accountId);
    var result = { captured: 0, duplicates: 0, skipped: [] };
    var scopedTargets = loadScopedTargets(db, accountId);
    var allTargets = loadAllTargets(db);
    var _loop_1 = function (value) {
        var key = observationKey(value);
        var normalized = normalizeObservation(value);
        if ("reason" in normalized) {
            console.log("[inbox-sync] Skipped (normalize): ".concat(normalized.reason, " - ").concat(JSON.stringify(value)));
            result.skipped.push(__assign(__assign({}, key), { reason: normalized.reason }));
            return "continue";
        }
        var resolution = resolveTarget(db, accountId, normalized, scopedTargets, allTargets);
        if ("reason" in resolution) {
            if (resolution.reason !== "unmatched_target" && resolution.reason !== "identity_conflict") {
                console.log("[inbox-sync] Skipped (resolve): ".concat(resolution.reason, " - ").concat(JSON.stringify(normalized)));
            }
            result.skipped.push(__assign(__assign({}, key), { reason: resolution.reason }));
            return "continue";
        }
        try {
            var captured_1 = (0, sdr_shim_1.captureSdrInboundMessage)(db, toSdrEvent(accountId, resolution.targetId, normalized, resolution.identityMode));
            if (captured_1.duplicate) {
                result.duplicates++;
            }
            else {
                result.captured++;
                // Trigger AI classification for the newly captured reply
                try {
                    // eslint-disable-next-line @typescript-eslint/no-require-imports
                    var premium = require("../../ee").premium;
                    if (premium === null || premium === void 0 ? void 0 : premium.replies) {
                        // Run in background without blocking the sync loop
                        premium.replies.classifyAndDispatch(captured_1.messageId).catch(function (err) {
                            console.warn("[inbox-sync] Failed AI classification for LinkedIn reply ".concat(captured_1.messageId, ":"), err);
                        });
                    }
                }
                catch (e) {
                    // No premium module
                }
            }
        }
        catch (error) {
            var reason = repositoryErrorReason(error);
            var errMsg = error instanceof Error ? error.message : String(error);
            console.log("[inbox-sync] Skipped message: ".concat(reason, " (DB ERROR: ").concat(errMsg, ") - ").concat(JSON.stringify(normalized)));
            result.skipped.push(__assign(__assign({}, key), { reason: reason }));
        }
    };
    for (var _i = 0, observations_1 = observations; _i < observations_1.length; _i++) {
        var value = observations_1[_i];
        _loop_1(value);
    }
    if (result.skipped.length > 0) {
        console.log("[inbox-sync] Total skipped in this batch: ".concat(result.skipped.length));
    }
    return result;
}
function isLinkedInAuthenticationWall(url) {
    return AUTH_WALL_PATTERN.test(url);
}
/**
 * Explicit read-only session wrapper. The observation source is injected so a
 * real LinkedIn wire parser cannot be introduced before its contract is proven.
 */
function syncLinkedInInboxReadOnly(options) {
    return __awaiter(this, void 0, void 0, function () {
        var db, session, openPage, persistState, reauth, page, wallUrl, currentUrl, observations, error_1, url, afterObserveUrl, result;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    db = (_a = options.db) !== null && _a !== void 0 ? _a : getDefaultDb();
                    accountIsReady(db, options.accountId);
                    session = (!options.pageFactory || !options.saveState || !options.markReauth)
                        ? getSessionRuntime()
                        : null;
                    openPage = (_b = options.pageFactory) !== null && _b !== void 0 ? _b : (function (accountId) { return session.getSessionPage(accountId); });
                    persistState = (_c = options.saveState) !== null && _c !== void 0 ? _c : (function (accountId) { return session.saveSessionState(accountId); });
                    reauth = (_d = options.markReauth) !== null && _d !== void 0 ? _d : (function (accountId) { return session.markNeedsReauth(accountId); });
                    return [4 /*yield*/, openPage(options.accountId)];
                case 1:
                    page = _e.sent();
                    wallUrl = null;
                    _e.label = 2;
                case 2:
                    _e.trys.push([2, , 8, 14]);
                    currentUrl = page.url();
                    if (isLinkedInAuthenticationWall(currentUrl)) {
                        wallUrl = currentUrl;
                        throw new LinkedInInboxAuthenticationError(currentUrl);
                    }
                    observations = void 0;
                    _e.label = 3;
                case 3:
                    _e.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, options.source.observe(page)];
                case 4:
                    observations = _e.sent();
                    return [3 /*break*/, 6];
                case 5:
                    error_1 = _e.sent();
                    url = page.url();
                    if (isLinkedInAuthenticationWall(url)) {
                        wallUrl = url;
                        throw new LinkedInInboxAuthenticationError(url);
                    }
                    throw error_1;
                case 6:
                    afterObserveUrl = page.url();
                    if (isLinkedInAuthenticationWall(afterObserveUrl)) {
                        wallUrl = afterObserveUrl;
                        throw new LinkedInInboxAuthenticationError(afterObserveUrl);
                    }
                    if (!Array.isArray(observations))
                        throw new Error("LinkedIn inbox observation source returned a non-array");
                    result = captureLinkedInInboxObservations(db, options.accountId, observations);
                    return [4 /*yield*/, persistState(options.accountId)];
                case 7:
                    _e.sent();
                    return [2 /*return*/, result];
                case 8:
                    _e.trys.push([8, , 10, 13]);
                    return [4 /*yield*/, page.close()];
                case 9:
                    _e.sent();
                    return [3 /*break*/, 13];
                case 10:
                    if (!wallUrl) return [3 /*break*/, 12];
                    return [4 /*yield*/, reauth(options.accountId)];
                case 11:
                    _e.sent();
                    _e.label = 12;
                case 12: return [7 /*endfinally*/];
                case 13: return [7 /*endfinally*/];
                case 14: return [2 /*return*/];
            }
        });
    });
}
