import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getDb } from "@/lib/db";

export function createMcpServer() {
  const server = new Server(
    {
      name: "linki-crm",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "search_contacts",
          description: "Search CRM contacts by name, title, or company.",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search term" },
              limit: { type: "number", description: "Max results (default 10)" },
            },
            required: ["query"],
          },
        },
        {
          name: "get_contact",
          description: "Get full details of a specific contact by ID.",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string", description: "Contact UUID" },
            },
            required: ["id"],
          },
        },
        {
          name: "update_contact",
          description: "Update fields on a contact (e.g. company_id, email).",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string" },
              fields: {
                type: "object",
                description: "Object containing fields to update (e.g. company_id, email, title, full_name, notes).",
              },
            },
            required: ["id", "fields"],
          },
        },
        {
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
          name: "search_companies",
          description: "Search companies by name.",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string" },
            },
            required: ["query"],
          },
        },
        {
          name: "sql_read_only",
          description: "Execute a SELECT query against the linki.db SQLite database. DO NOT attempt to write or mutate data.",
          inputSchema: {
            type: "object",
            properties: {
              sql: { type: "string", description: "The SQL SELECT statement." },
            },
            required: ["sql"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const db = getDb();
    const { name, arguments: args } = request.params;

    try {
      if (name === "search_contacts") {
        const query = (args?.query as string) || "";
        const limit = Number(args?.limit) || 10;
        const like = `%${query}%`;
        const rows = db.prepare(`
          SELECT id, full_name, title, company, company_id, email, linkedin_url
          FROM targets
          WHERE full_name LIKE ? OR title LIKE ? OR company LIKE ?
          LIMIT ?
        `).all(like, like, like, limit);
        return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
      }

      if (name === "get_contact") {
        const id = args?.id as string;
        const row = db.prepare("SELECT * FROM targets WHERE id = ?").get(id);
        if (!row) throw new Error("Contact not found");
        return { content: [{ type: "text", text: JSON.stringify(row, null, 2) }] };
      }

      if (name === "update_contact") {
        const id = args?.id as string;
        const fields = args?.fields as Record<string, any>;
        const allowed = ["first_name", "last_name", "full_name", "title", "company", "location", "email", "phone", "headline", "summary", "notes", "company_id"];
        const updates: string[] = [];
        const params: any[] = [];
        for (const [k, v] of Object.entries(fields)) {
          if (allowed.includes(k)) {
            updates.push(`${k} = ?`);
            params.push(v);
          }
        }
        if (updates.length > 0) {
          params.push(id);
          db.prepare(`UPDATE targets SET ${updates.join(", ")} WHERE id = ?`).run(...params);
          return { content: [{ type: "text", text: "Update successful" }] };
        }
        throw new Error("No valid fields provided to update");
      }

      if (name === "list_active_campaigns") {
        const rows = db.prepare(`
          SELECT r.id, r.status, w.name as workflow_name, a.name as account_name
          FROM runs r
          JOIN workflows w ON w.id = r.workflow_id
          JOIN accounts a ON a.id = r.account_id
          WHERE r.status = 'running'
        `).all();
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
        
        const res = db.prepare(`UPDATE run_profile_tracks SET state = 'skipped', error_message = 'Manually unenrolled by AI' WHERE run_profile_id = ? AND state IN ('pending', 'in_progress')`).run(rp.id);
        
        return { content: [{ type: "text", text: `Unenrolled. ${res.changes} tracks stopped.` }] };
      }

      if (name === "search_companies") {
        const query = args?.query as string;
        const rows = db.prepare(`SELECT * FROM companies WHERE name LIKE ? LIMIT 10`).all(`%${query}%`);
        return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
      }

      if (name === "sql_read_only") {
        let sql = (args?.sql as string) || "";
        if (!sql.trim().toUpperCase().startsWith("SELECT")) {
           throw new Error("Only SELECT statements are permitted.");
        }
        const rows = db.prepare(sql).all();
        return { content: [{ type: "text", text: JSON.stringify(rows, null, 2).slice(0, 50000) }] }; // Guard output size
      }

      throw new Error(`Unknown tool: ${name}`);
    } catch (e: any) {
      return { isError: true, content: [{ type: "text", text: e.message || String(e) }] };
    }
  });

  return server;
}
