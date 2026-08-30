const fs = require('fs');
let code = fs.readFileSync('pages/api/inbox/thread.ts', 'utf8');

const replacement = `fetch.once("end", async () => {
            await Promise.allSettled(pending);
            
            // Build undirected thread graph to isolate conversation
            let finalMessages = messages;
            
            // Step 1: Promote legacy IMAP messages to root nodes if their timestamps match legacy DB records
            for (const m of messages) {
              if (m.messageId && legacyTimes.has(new Date(m.date).getTime())) {
                knownMessageIds.add(m.messageId.replace(/^<|>$/g, ''));
              }
            }

            if (knownMessageIds.size > 0) {
              const graph = new Map<string, Set<string>>();
              const addEdge = (u, v) => {
                if (!graph.has(u)) graph.set(u, new Set());
                if (!graph.has(v)) graph.set(v, new Set());
                graph.get(u).add(v);
                graph.get(v).add(u);
              };

              for (const m of messages) {
                if (!m.messageId) continue;
                const u = m.messageId.replace(/^<|>$/g, '');
                const rawRefs = [m.inReplyTo, ...(m.references || [])];
                const refs = rawRefs
                  .filter((r) => typeof r === 'string')
                  .map(r => r.replace(/^<|>$/g, ''));
                for (const v of refs) addEdge(u, v);
              }

              const connected = new Set();
              const queue = [...knownMessageIds];
              
              while (queue.length > 0) {
                const curr = queue.pop();
                if (connected.has(curr)) continue;
                connected.add(curr);
                if (graph.has(curr)) {
                  for (const neighbor of graph.get(curr)) {
                    if (!connected.has(neighbor)) queue.push(neighbor);
                  }
                }
              }
              
              finalMessages = messages.filter(m => m.messageId && connected.has(m.messageId.replace(/^<|>$/g, '')));
            }

            finalMessages.sort((a, b) => a.date.localeCompare(b.date));
            resolve(finalMessages);
            done();
          });`;

const startIdx = code.indexOf('fetch.once("end", async () => {');
const endStr = 'resolve(finalMessages);\n            done();\n\n          });';
let endIdx = code.indexOf(endStr);
if (endIdx === -1) endIdx = code.indexOf('resolve(finalMessages);\n            done();\n          });');

code = code.substring(0, startIdx) + replacement + code.substring(endIdx + endStr.length);
fs.writeFileSync('pages/api/inbox/thread.ts', code);
