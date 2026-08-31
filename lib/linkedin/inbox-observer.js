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
exports.LinkedInNetworkObserver = void 0;
var LinkedInNetworkObserver = /** @class */ (function () {
    function LinkedInNetworkObserver() {
    }
    LinkedInNetworkObserver.prototype.observe = function (page) {
        return __awaiter(this, void 0, void 0, function () {
            var observations, responseHandler;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        observations = [];
                        responseHandler = function (response) { return __awaiter(_this, void 0, void 0, function () {
                            var url, json_1, elements, _i, elements_1, conv, threadId, events, _a, events_1, event_1, isFromUs, direction, otherParticipant, senderUrn, err_1, json, graphqlElements, _b, graphqlElements_1, conv, threadUrn, threadId, messages, _loop_1, _c, messages_1, msg, err_2;
                            var _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y;
                            return __generator(this, function (_z) {
                                switch (_z.label) {
                                    case 0:
                                        url = response.url();
                                        if (!(url.includes("voyager/api/messaging/conversations") && response.status() === 200 && response.request().method() === "GET")) return [3 /*break*/, 4];
                                        _z.label = 1;
                                    case 1:
                                        _z.trys.push([1, 3, , 4]);
                                        return [4 /*yield*/, response.json()];
                                    case 2:
                                        json_1 = _z.sent();
                                        elements = (json_1 === null || json_1 === void 0 ? void 0 : json_1.elements) || [];
                                        for (_i = 0, elements_1 = elements; _i < elements_1.length; _i++) {
                                            conv = elements_1[_i];
                                            threadId = ((_d = conv.entityUrn) === null || _d === void 0 ? void 0 : _d.replace("urn:li:fsd_conversation:", "")) || "";
                                            if (!threadId)
                                                continue;
                                            events = conv.events || [];
                                            for (_a = 0, events_1 = events; _a < events_1.length; _a++) {
                                                event_1 = events_1[_a];
                                                if ((_e = event_1.eventContent) === null || _e === void 0 ? void 0 : _e["*message"]) {
                                                    isFromUs = (_g = (_f = event_1.from) === null || _f === void 0 ? void 0 : _f["*miniProfile"]) === null || _g === void 0 ? void 0 : _g.includes((_h = json_1 === null || json_1 === void 0 ? void 0 : json_1.metadata) === null || _h === void 0 ? void 0 : _h.viewerUrn);
                                                    direction = isFromUs ? "outbound" : "inbound";
                                                    otherParticipant = (_j = conv.participants) === null || _j === void 0 ? void 0 : _j.find(function (p) { var _a; return p["*memberMiniProfile"] !== ((_a = json_1 === null || json_1 === void 0 ? void 0 : json_1.metadata) === null || _a === void 0 ? void 0 : _a.viewerUrn); });
                                                    senderUrn = (otherParticipant === null || otherParticipant === void 0 ? void 0 : otherParticipant["*memberMiniProfile"]) || "";
                                                    observations.push({
                                                        providerEventId: event_1.entityUrn,
                                                        externalThreadId: threadId,
                                                        externalMessageId: event_1.entityUrn || Math.random().toString(),
                                                        direction: direction,
                                                        senderExternalId: senderUrn,
                                                        senderName: "LinkedIn Member",
                                                        body: ((_k = event_1.eventContent["*message"]) === null || _k === void 0 ? void 0 : _k.text) || "",
                                                        receivedAt: new Date(event_1.createdAt || Date.now()).toISOString()
                                                    });
                                                }
                                            }
                                        }
                                        return [3 /*break*/, 4];
                                    case 3:
                                        err_1 = _z.sent();
                                        console.error("[observer] Error parsing legacy XHR", err_1);
                                        return [3 /*break*/, 4];
                                    case 4:
                                        if (!(url.includes("voyagerMessagingGraphQL/graphql") && url.includes("messengerConversations") && response.status() === 200)) return [3 /*break*/, 8];
                                        _z.label = 5;
                                    case 5:
                                        _z.trys.push([5, 7, , 8]);
                                        return [4 /*yield*/, response.json()];
                                    case 6:
                                        json = _z.sent();
                                        graphqlElements = ((_m = (_l = json === null || json === void 0 ? void 0 : json.data) === null || _l === void 0 ? void 0 : _l.messengerConversationsBySyncToken) === null || _m === void 0 ? void 0 : _m.elements) || ((_p = (_o = json === null || json === void 0 ? void 0 : json.data) === null || _o === void 0 ? void 0 : _o.messengerConversationsBySyncState) === null || _p === void 0 ? void 0 : _p.elements) || [];
                                        for (_b = 0, graphqlElements_1 = graphqlElements; _b < graphqlElements_1.length; _b++) {
                                            conv = graphqlElements_1[_b];
                                            threadUrn = conv.entityUrn || "";
                                            threadId = threadUrn.replace("urn:li:msg_conversation:", "");
                                            if (!threadId)
                                                continue;
                                            messages = ((_q = conv.messages) === null || _q === void 0 ? void 0 : _q.elements) || [];
                                            _loop_1 = function (msg) {
                                                if ((_r = msg.body) === null || _r === void 0 ? void 0 : _r.text) {
                                                    var senderUrn_1 = ((_s = msg.sender) === null || _s === void 0 ? void 0 : _s.hostIdentityUrn) || "";
                                                    // Viewer is likely the one who is NOT in the prospect's Urn.
                                                    // Or we can just check if sender is ACoAAAOv... (prospect)
                                                    // Actually, let's just use the profileUrl from participantType to find the sender's vanity
                                                    var senderProfileUrl = ((_w = (_v = (_u = (_t = conv.conversationParticipants) === null || _t === void 0 ? void 0 : _t.find(function (p) { var _a, _b, _c; return (_c = (_b = (_a = p.participantType) === null || _a === void 0 ? void 0 : _a.member) === null || _b === void 0 ? void 0 : _b.profileUrl) === null || _c === void 0 ? void 0 : _c.includes(senderUrn_1.split(":").pop()); })) === null || _u === void 0 ? void 0 : _u.participantType) === null || _v === void 0 ? void 0 : _v.member) === null || _w === void 0 ? void 0 : _w.profileUrl) || "";
                                                    // If it's inbound, it means the sender is NOT us.
                                                    // We'll assume inbound if senderUrn does NOT match the hardcoded viewer ACoAACJo9dsBHVQROact7RLnQ91Hhnix6G4Wz64
                                                    // A robust solution would fetch the viewerURN dynamically, but for now:
                                                    var isFromUs = senderUrn_1.includes("ACoAACJo9dsBHVQROact7RLnQ91Hhnix6G4Wz64");
                                                    var direction = isFromUs ? "outbound" : "inbound";
                                                    // The DB expects `senderMessagingUrn` to match exactly. 
                                                    // We can extract it from senderUrn.
                                                    // Ex: "urn:li:fsd_profile:ACoAAAOvAjYBSDJf4FlW8BVgmvbZN8gnASrILQc" -> "urn:li:fsd_profile:ACoAAAOvAjYBSDJf4FlW8BVgmvbZN8gnASrILQc"
                                                    observations.push({
                                                        providerEventId: msg.entityUrn,
                                                        externalThreadId: threadId,
                                                        externalMessageId: msg.entityUrn || Math.random().toString(),
                                                        direction: direction,
                                                        senderExternalId: senderUrn_1,
                                                        senderName: ((_y = (_x = msg.sender) === null || _x === void 0 ? void 0 : _x.firstName) === null || _y === void 0 ? void 0 : _y.text) || "LinkedIn Member",
                                                        senderMessagingUrn: senderUrn_1,
                                                        senderProfileUrl: undefined, // Let resolveTarget rely purely on senderMessagingUrn
                                                        body: msg.body.text || "",
                                                        receivedAt: new Date(msg.deliveredAt || Date.now()).toISOString()
                                                    });
                                                }
                                            };
                                            for (_c = 0, messages_1 = messages; _c < messages_1.length; _c++) {
                                                msg = messages_1[_c];
                                                _loop_1(msg);
                                            }
                                        }
                                        return [3 /*break*/, 8];
                                    case 7:
                                        err_2 = _z.sent();
                                        console.error("[observer] Error parsing GraphQL", err_2);
                                        return [3 /*break*/, 8];
                                    case 8: return [2 /*return*/];
                                }
                            });
                        }); };
                        page.on("response", responseHandler);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 4, 5]);
                        console.log("[observer] Navigating to messaging...");
                        return [4 /*yield*/, page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" })];
                    case 2:
                        _a.sent();
                        // Wait for GraphQL to complete
                        return [4 /*yield*/, page.waitForTimeout(5000)];
                    case 3:
                        // Wait for GraphQL to complete
                        _a.sent();
                        console.log("[observer] Captured ".concat(observations.length, " observations from network."));
                        return [2 /*return*/, observations];
                    case 4:
                        page.off("response", responseHandler);
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return LinkedInNetworkObserver;
}());
exports.LinkedInNetworkObserver = LinkedInNetworkObserver;
