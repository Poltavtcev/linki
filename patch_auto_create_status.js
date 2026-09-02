const fs = require('fs');
let code = fs.readFileSync('lib/csv-import.ts', 'utf8');

// Remove the old resolveCrmStatus function
code = code.replace(/function resolveCrmStatus[\s\S]*?return match \? match.id : null;\n}/, '');

const resolverClass = `class CrmStatusResolver {
  private statuses: any[];
  private updated = false;

  constructor(private db: DB) {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'crm_statuses'").get() as { value: string } | undefined;
    this.statuses = [
      { id: "lead", label: "Lead", color: "bg-base-300", blocks_enrollment: false },
      { id: "outreach", label: "Outreach", color: "bg-info/20 text-info", blocks_enrollment: false },
      { id: "engaged", label: "Engaged", color: "bg-primary/20 text-primary", blocks_enrollment: false },
      { id: "meeting", label: "Meeting", color: "bg-warning/20 text-warning", blocks_enrollment: true },
      { id: "opportunity", label: "Opportunity", color: "bg-success/20 text-success", blocks_enrollment: true },
      { id: "customer", label: "Customer", color: "bg-success text-success-content", blocks_enrollment: true },
      { id: "nurture", label: "Nurture", color: "bg-secondary/20 text-secondary", blocks_enrollment: false },
      { id: "disqualified", label: "Disqualified", color: "bg-error/20 text-error", blocks_enrollment: true }
    ];
    if (row) {
      try { this.statuses = JSON.parse(row.value); } catch(e) {}
    }
  }

  resolve(rawStatus: string): string | null {
    const s = rawStatus.trim();
    if (!s) return null;
    const lower = s.toLowerCase();
    
    let match = this.statuses.find(st => st.id === lower || st.label.toLowerCase() === lower);
    if (match) return match.id;

    const id = lower.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!id) return null;

    match = this.statuses.find(st => st.id === id);
    if (match) return match.id;

    this.statuses.push({
      id,
      label: s,
      color: "bg-base-300",
      blocks_enrollment: false
    });
    this.updated = true;
    return id;
  }

  flush() {
    if (this.updated) {
      this.db.prepare("INSERT INTO app_settings (key, value) VALUES ('crm_statuses', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(this.statuses));
      this.updated = false;
    }
  }
}`;

code = code.replace(`function get(row: Record<string, string>, key: string): string | null {`, resolverClass + `\n\nfunction get(row: Record<string, string>, key: string): string | null {`);

code = code.replace(
  `  const errors: string[] = [];`,
  `  const statusResolver = new CrmStatusResolver(db);\n  const errors: string[] = [];`
);

code = code.replace(
  `const resolved = resolveCrmStatus(db, fields.lead_status);`,
  `const resolved = statusResolver.resolve(fields.lead_status);`
);

code = code.replace(
  `  db.transaction(() => {`,
  `  statusResolver.flush();\n\n  db.transaction(() => {`
);

fs.writeFileSync('lib/csv-import.ts', code);
