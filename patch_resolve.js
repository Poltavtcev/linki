const fs = require('fs');
let code = fs.readFileSync('lib/linkedin/inbox-sync.ts', 'utf8');

const regex = /function resolveTarget\([\s\S]*?return { reason: "unmatched_target" };\n}/;
const replaceStr = `function resolveTarget(
  db: Database.Database,
  accountId: string,
  normalized: NormalizedObservation,
  scoped: ScopedTarget[],
  allTargets: ScopedTarget[]
): TargetResolution | { reason: LinkedInInboxSkipReason } {
  const urnIds = normalized.senderMessagingUrn ? idsForMessagingUrn(allTargets, normalized.senderMessagingUrn) : [];
  const vanityIds = normalized.senderVanity ? idsForVanity(allTargets, normalized.senderVanity) : [];

  if (normalized.senderMessagingUrn && normalized.senderVanity) {
    if (urnIds.length > 1 || vanityIds.length > 1) return { reason: "ambiguous_target" };
    if (urnIds.length === 1 && vanityIds.length === 1 && urnIds[0] !== vanityIds[0]) {
      return { reason: "identity_conflict" };
    }
    if (urnIds.length === 1) return { targetId: urnIds[0], identityMode: "messaging_urn" };
    if (vanityIds.length === 1) return { targetId: vanityIds[0], identityMode: "profile_url" };
    return { reason: "unmatched_target" };
  }

  if (normalized.senderMessagingUrn) {
    if (urnIds.length > 1) return { reason: "ambiguous_target" };
    if (urnIds.length === 1) return { targetId: urnIds[0], identityMode: "messaging_urn" };
    return { reason: "unmatched_target" };
  }

  if (vanityIds.length > 1) return { reason: "ambiguous_target" };
  if (vanityIds.length === 1) return { targetId: vanityIds[0], identityMode: "profile_url" };
  return { reason: "unmatched_target" };
}`;

if (code.match(regex)) {
  code = code.replace(regex, replaceStr);
  fs.writeFileSync('lib/linkedin/inbox-sync.ts', code);
  console.log("Patched resolveTarget correctly");
} else {
  console.log("Regex didn't match");
}
