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
var env_1 = require("@next/env");
(0, env_1.loadEnvConfig)(process.cwd());
var session_1 = require("./lib/linkedin/session");
var ACCOUNT_ID = "2f759b56-56d3-4ca0-a10f-ec96c1cd5e2c";
function run() {
    return __awaiter(this, void 0, void 0, function () {
        var page, olderThanDays, targetToWithdraw, cardHandle, actionBtns, withdrawBtn, _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, (0, session_1.getSessionPage)(ACCOUNT_ID)];
                case 1:
                    page = _d.sent();
                    return [4 /*yield*/, page.goto("https://www.linkedin.com/mynetwork/invitation-manager/sent/", { waitUntil: "domcontentloaded" })];
                case 2:
                    _d.sent();
                    return [4 /*yield*/, page.waitForTimeout(3000)];
                case 3:
                    _d.sent();
                    olderThanDays = 0;
                    return [4 /*yield*/, page.evaluate(function (olderThan) {
                            var _a, _b, _c;
                            var profileLinks = Array.from(document.querySelectorAll('a[href*="/in/"]'));
                            var cards = new Set();
                            for (var _i = 0, profileLinks_1 = profileLinks; _i < profileLinks_1.length; _i++) {
                                var link = profileLinks_1[_i];
                                var card = link.closest('li, .invitation-card, .discovery-entity-card');
                                if (card)
                                    cards.add(card);
                            }
                            var cardsArray = Array.from(cards);
                            for (var i = 0; i < cardsArray.length; i++) {
                                var card = cardsArray[i];
                                var nameEl = card.querySelector('span[dir="ltr"], .invitation-card__title, span[aria-hidden="true"]');
                                var name_1 = nameEl ? (_a = nameEl.textContent) === null || _a === void 0 ? void 0 : _a.trim().split(' ')[0] : '';
                                var textContent = ((_b = card.textContent) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || "";
                                var ageDays = null;
                                var match = textContent.match(/(\d+)\s*(hour|day|week|month|year|год|дн|тиж|нед|міс|мес|рік|рок|лет|jour|sem|mois|an|dia|mes|año|tag|woch|mona|jahr)/i);
                                if (match) {
                                    var num = parseInt(match[1], 10);
                                    var unit = match[2];
                                    if (/hour|год/i.test(unit))
                                        ageDays = 0;
                                    else if (/day|дн|jour|dia|tag/i.test(unit))
                                        ageDays = num;
                                    else if (/week|тиж|нед|sem|woch/i.test(unit))
                                        ageDays = num * 7;
                                    else if (/month|міс|мес|mois|mes|mona/i.test(unit))
                                        ageDays = num * 30;
                                    else if (/year|рік|рок|лет|an|año|jahr/i.test(unit))
                                        ageDays = num * 365;
                                }
                                if (ageDays !== null && ageDays >= olderThan) {
                                    var url = ((_c = card.querySelector('a[href*="/in/"]')) === null || _c === void 0 ? void 0 : _c.getAttribute('href')) || null;
                                    return { index: i, url: url, ageDays: ageDays, name: name_1 };
                                }
                            }
                            return null;
                        }, olderThanDays)];
                case 4:
                    targetToWithdraw = _d.sent();
                    console.log("Found target to withdraw:", targetToWithdraw);
                    if (!targetToWithdraw) return [3 /*break*/, 9];
                    cardHandle = page.locator('a[href*="/in/"]').locator('xpath=ancestor-or-self::li | ancestor-or-self::*[contains(@class, "invitation-card")] | ancestor-or-self::*[contains(@class, "discovery-entity-card")]').nth(targetToWithdraw.index);
                    actionBtns = cardHandle.locator('button, a[role="button"], a').filter({
                        hasNot: page.locator('img, svg, a[href*="/in/"]')
                    });
                    withdrawBtn = actionBtns.filter({ has: page.locator("[aria-label*=\"".concat(targetToWithdraw.name, "\"]")) }).first();
                    return [4 /*yield*/, withdrawBtn.count()];
                case 5:
                    if ((_d.sent()) === 0) {
                        withdrawBtn = actionBtns.last();
                    }
                    return [4 /*yield*/, withdrawBtn.count()];
                case 6:
                    if (!((_d.sent()) > 0)) return [3 /*break*/, 8];
                    _b = (_a = console).log;
                    _c = ["Successfully found withdraw button! Text:"];
                    return [4 /*yield*/, withdrawBtn.textContent()];
                case 7:
                    _b.apply(_a, _c.concat([_d.sent()]));
                    return [3 /*break*/, 9];
                case 8:
                    console.log("Failed to find withdraw button via Locator");
                    _d.label = 9;
                case 9: return [4 /*yield*/, page.close()];
                case 10:
                    _d.sent();
                    process.exit(0);
                    return [2 /*return*/];
            }
        });
    });
}
// Remove getDb import from session.ts temporarily for testing
