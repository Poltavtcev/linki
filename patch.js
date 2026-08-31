const fs = require('fs');
let content = fs.readFileSync('lib/mcp/server.ts', 'utf8');

const newTools = `        {
          name: "list_active_campaigns",
          description: "List currently active campaigns (runs).",
          inputSchema: { type: "object", properties: {}, required: [] },
        },
        {
          name: "enroll_contact",
          description: "Enroll a contact in an active campaign.",
          inputSchema: {
            type: "object",
            properties: {
              run_id: { type: "string", description: "ID of the active campaign (run)" },
              target_id: { type: "string", description: "ID of the contact to enroll" }
            },
            required: ["run_id", "target_id"],
          },
        },
        {
          name: "unenroll_contact",
          description: "Unenroll/stop a contact from an active campaign.",
          inputSchema: {
            type: "object",
            properties: {
              run_id: { type: "string", description: "ID of the active campaign (run)" },
              target_id: { type: "string", description: "ID of the contact to unenroll" }
            },
            required: ["run_id", "target_id"],
          },
        },
        {
          name: "search_companies",`;

content = content.replace(/        \{\n          name: "search_companies",/g, newTools);

const newHandlers = `      if (name === "list_active_campaigns") {
        const rows = db.prepare(\`
          SELECT r.id, r.status, w.name as workflow_name, a.name as account_name
          FROM runs r
          JOIN workflows w ON w.id = r.workflow_id
          JOIN accounts a ON a.id = r.account_id
          WHERE r.status = 'running'
        \`).all();
        return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
      }

      if (name === "enroll_contact") {
        const run_id = args?.run_id as string;
        const target_id = args?.target_id as string;
        
        const run = db.prepare("SELECT id, workflow_id FROM runs WHERE id = ?").get(run_id) as any;
        if (!run) throw new Error("Run not found");
        
        const already = db.prepare("SELECT 1 FROM run_profiles WHERE run_id = ? AND target_id = ?").get(run_id, target_id);
        if (already) throw new Error("Already enrolled in this campaign");
        
        const rpId = require("crypto").randomUUID();
        db.prepare("INSERT INTO run_profiles (id, run_id, target_id) VALUES (?, ?, ?)").run(rpId, run_id, target_id);
        
        const tracks = db.prepare("SELECT DISTINCT track FROM workflow_steps WHERE workflow_id = ?").all(run.workflow_id) as any[];
        if (tracks.length === 0) tracks.push({ track: "linkedin" });
        
        const insertTrack = db.prepare("INSERT INTO run_profile_tracks (id, run_profile_id, track, state, current_step) VALUES (?, ?, ?, 'pending', 0)");
        db.transaction(() => {
          for (const tr of tracks) {
            insertTrack.run(require("crypto").randomUUID(), rpId, tr.track);
          }
        })();
        
        return { content: [{ type: "text", text: "Successfully enrolled contact in campaign" }] };
      }

      if (name === "unenroll_contact") {
        const run_id = args?.run_id as string;
        const target_id = args?.target_id as string;
        
        const rp = db.prepare("SELECT id FROM run_profiles WHERE run_id = ? AND target_id = ?").get(run_id, target_id) as any;
        if (!rp) throw new Error("Contact is not enrolled in this campaign");
        
        const res = db.prepare(\`UPDATE run_profile_tracks SET state = 'skipped', error_message = 'Manually unenrolled by AI' WHERE run_profile_id = ? AND state IN ('pending', 'in_progress')\`).run(rp.id);
        
        return { content: [{ type: "text", text: \`Unenrolled. \${res.changes} tracks stopped.\` }] };
      }

      if (name === "search_companies") {`;

content = content.replace(/      if \(name === "search_companies"\) \{/g, newHandlers);

fs.writeFileSync('lib/mcp/server.ts', content);
