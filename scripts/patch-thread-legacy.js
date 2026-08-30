const fs = require('fs');
let code = fs.readFileSync('pages/api/inbox/thread.ts', 'utf8');

// Replace the naive legacy check
const oldLegacyCheck = `const legacyCheck = db.prepare("SELECT 1 FROM email_replies WHERE target_id = ? AND message_id IS NULL LIMIT 1").get(targetId);
    const hasLegacyReplies = !!legacyCheck;
    
    const knownIdsRows = db.prepare(\`
      SELECT last_email_message_id AS msg_id FROM run_profile_tracks rt
      JOIN run_profiles rp ON rp.id = rt.run_profile_id
      WHERE rp.target_id = ? AND rt.last_email_message_id IS NOT NULL
      UNION
      SELECT message_id AS msg_id FROM email_replies WHERE target_id = ? AND message_id IS NOT NULL
    \`).all(targetId, targetId) as { msg_id: string }[];
    const knownMessageIds = new Set(knownIdsRows.map(r => r.msg_id.trim().replace(/^<|>$/g, '')));`;

const newLegacyCheck = `const legacyRows = db.prepare("SELECT received_at FROM email_replies WHERE target_id = ? AND message_id IS NULL").all(targetId) as { received_at: string }[];
    const legacyTimes = new Set(legacyRows.map(r => new Date(r.received_at).getTime()));
    
    const knownIdsRows = db.prepare(\`
      SELECT last_email_message_id AS msg_id FROM run_profile_tracks rt
      JOIN run_profiles rp ON rp.id = rt.run_profile_id
      WHERE rp.target_id = ? AND rt.last_email_message_id IS NOT NULL
      UNION
      SELECT message_id AS msg_id FROM email_replies WHERE target_id = ? AND message_id IS NOT NULL
    \`).all(targetId, targetId) as { msg_id: string }[];
    const knownMessageIds = new Set(knownIdsRows.map(r => r.msg_id.trim().replace(/^<|>$/g, '')));`;

code = code.replace(oldLegacyCheck, newLegacyCheck);

// Update fetchThread signature
code = code.replace(
  /hasLegacyReplies: boolean/,
  `legacyTimes: Set<number>`
);
code = code.replace(
  /hasLegacyReplies\n    \);/,
  `legacyTimes\n    );`
);

// Update graph traversal
const oldGraphCode = `            // Build undirected thread graph to isolate conversation
            let finalMessages = messages;
            
            // If the target has legacy replies (no message_id stored), we must bypass the filter
            // to ensure backward compatibility, otherwise old threads will vanish.
            if (!hasLegacyReplies && knownMessageIds.size > 0) {
              const graph = new Map<string, Set<string>>();
              const addEdge = (u: string, v: string) => {
                if (!graph.has(u)) graph.set(u, new Set());
                if (!graph.has(v)) graph.set(v, new Set());
                graph.get(u)!.add(v);
                graph.get(v)!.add(u);
              };

              for (const m of messages) {
                if (!m.messageId) continue;
                const u = m.messageId.replace(/^<|>$/g, '');
                const refs = [m.inReplyTo, ...(m.references || [])].filter(Boolean).map(r => r.replace(/^<|>$/g, ''));
                for (const v of refs) addEdge(u, v);
              }

              const connected = new Set<string>();
              const queue = [...knownMessageIds];
              
              while (queue.length > 0) {
                const curr = queue.pop()!;
                if (connected.has(curr)) continue;
                connected.add(curr);
                if (graph.has(curr)) {
                  for (const neighbor of graph.get(curr)!) {
                    if (!connected.has(neighbor)) queue.push(neighbor);
                  }
                }
              }
              
              finalMessages = messages.filter(m => m.messageId && connected.has(m.messageId.replace(/^<|>$/g, '')));
            }`;

const newGraphCode = `            // Build undirected thread graph to isolate conversation
            let finalMessages = messages;
            
            // Step 1: Promote legacy IMAP messages to root nodes if their timestamps match legacy DB records
            for (const m of messages) {
              if (m.messageId && legacyTimes.has(new Date(m.date).getTime())) {
                knownMessageIds.add(m.messageId.replace(/^<|>$/g, ''));
              }
            }

            if (knownMessageIds.size > 0) {
              const graph = new Map<string, Set<string>>();
              const addEdge = (u: string, v: string) => {
                if (!graph.has(u)) graph.set(u, new Set());
                if (!graph.has(v)) graph.set(v, new Set());
                graph.get(u)!.add(v);
                graph.get(v)!.add(u);
              };

              for (const m of messages) {
                if (!m.messageId) continue;
                const u = m.messageId.replace(/^<|>$/g, '');
                const refs = [m.inReplyTo, ...(m.references || [])].filter(Boolean).map(r => r.replace(/^<|>$/g, ''));
                for (const v of refs) addEdge(u, v);
              }

              const connected = new Set<string>();
              const queue = [...knownMessageIds];
              
              while (queue.length > 0) {
                const curr = queue.pop()!;
                if (connected.has(curr)) continue;
                connected.add(curr);
                if (graph.has(curr)) {
                  for (const neighbor of graph.get(curr)!) {
                    if (!connected.has(neighbor)) queue.push(neighbor);
                  }
                }
              }
              
              finalMessages = messages.filter(m => m.messageId && connected.has(m.messageId.replace(/^<|>$/g, '')));
            }`;

code = code.replace(oldGraphCode, newGraphCode);
fs.writeFileSync('pages/api/inbox/thread.ts', code);
