const fs = require('fs');

let content = fs.readFileSync('lib/mcp/server.ts', 'utf8');

const newGetContact = `      if (name === "get_contact") {
        const id = args?.id as string;
        const row = db.prepare("SELECT * FROM targets WHERE id = ?").get(id);
        if (!row) throw new Error("Contact not found");
        
        // Also fetch active campaigns this contact is enrolled in
        const activeCampaigns = db.prepare(\`
          SELECT r.id as run_id, w.name as workflow_name, r.status
          FROM run_profiles rp
          JOIN runs r ON r.id = rp.run_id
          JOIN workflows w ON w.id = r.workflow_id
          WHERE rp.target_id = ? AND r.status = 'running'
        \`).all(id);
        
        const result = {
          contact: row,
          active_campaigns: activeCampaigns
        };
        
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }`;

content = content.replace(/      if \(name === "get_contact"\) \{[\s\S]*?return \{ content: \[\{ type: "text", text: JSON.stringify\(row, null, 2\) \}\] \};\n      \}/, newGetContact);

fs.writeFileSync('lib/mcp/server.ts', content);
