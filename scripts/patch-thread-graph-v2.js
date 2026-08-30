const fs = require('fs');
let code = fs.readFileSync('pages/api/inbox/thread.ts', 'utf8');

// 1. Check for legacy replies
code = code.replace(
  /const knownIdsRows = db.prepare\(/,
  `const legacyCheck = db.prepare("SELECT 1 FROM email_replies WHERE target_id = ? AND message_id IS NULL LIMIT 1").get(targetId);
    const hasLegacyReplies = !!legacyCheck;
    
    const knownIdsRows = db.prepare(`
);

// 2. Add hasLegacyReplies to fetchThread signature
code = code.replace(
  /async function fetchThread\(cfg: ImapConfig, contactEmail: string, ownerEmail: string, knownMessageIds: Set<string>\): Promise<EmailMessage\[\]> \{/,
  `async function fetchThread(cfg: ImapConfig, contactEmail: string, ownerEmail: string, knownMessageIds: Set<string>, hasLegacyReplies: boolean): Promise<EmailMessage[]> {`
);
code = code.replace(
  /knownMessageIds\s*\);/,
  `knownMessageIds,\n      hasLegacyReplies\n    );`
);

// 3. Rewrite graph traversal (undirected BFS) and remove isSelfTest specific limit
const oldGraphCode = `            // Build thread graph to filter out irrelevant emails (Bug B fix)
            const isSelfTest = contactEmail === ownerEmail;
            let finalMessages = messages;

            if (isSelfTest) {
              const connected = new Set<string>();
              for (const id of knownMessageIds) connected.add(id);
              
              let changed = true;
              while (changed) {
                changed = false;
                for (const m of messages) {
                  if (!m.messageId) continue;
                  const mId = m.messageId.replace(/^<|>$/g, '');
                  if (connected.has(mId)) continue;

                  let linked = false;
                  
                  // Check if it links to a known message
                  const refs = [m.inReplyTo, ...(m.references || [])].filter(Boolean).map(r => r.replace(/^<|>$/g, ''));
                  if (knownMessageIds.has(mId) || refs.some(r => connected.has(r))) {
                    connected.add(mId);
                    linked = true;
                    changed = true;
                  }
  
                }
              }
              finalMessages = messages.filter(m => m.messageId && connected.has(m.messageId.replace(/^<|>$/g, '')));
            }`;

const newGraphCode = `            // Build undirected thread graph to isolate conversation
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

code = code.replace(oldGraphCode, newGraphCode);

fs.writeFileSync('pages/api/inbox/thread.ts', code);
