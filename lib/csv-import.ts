import Papa from "papaparse";
import type DatabaseType from "better-sqlite3";
import { randomUUID } from "crypto";

type DB = DatabaseType.Database;

// User-fillable target fields — everything else on `targets` (URNs, JSON blobs,
// enrichment timestamps, apollo/automation internals) is system-owned and not
// importable. Mirrors the PATCH /api/targets/[id] editable set.
const EDITABLE_FIELDS = [
  "first_name", "last_name", "title", "company", "location",
  "city", "country", "time_zone", "phone", "headline", "summary", "notes",
  "lead_status", "seniority"
] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

// One template covers every case: a pure LinkedIn list, a pure email list (incl.
// generic inboxes like info@company.com), or an export that already has both
// (e.g. a list exported from another tool). Each row just needs linkedin_url
// and/or email filled in — whatever the contact actually has.
const TEMPLATE_COLUMNS = ["linkedin_url", "sales_nav_url", "email", ...EDITABLE_FIELDS] as const;

const SAMPLE_VALUES: Record<EditableField, string> = {
  first_name: "Jane",
  last_name: "Doe",
  title: "Head of Marketing",
  company: "Acme Inc",
  location: "Berlin, Germany",
  city: "Berlin",
  country: "Germany",
  phone: "+49 30 1234567",
  headline: "Head of Marketing @ Acme Inc",
  summary: "10+ years in B2B SaaS marketing.",
  notes: "Met at SaaStr 2026",
  time_zone: "Europe/Berlin",
  lead_status: "lead",
  seniority: "Director",
};

export function buildCsvTemplate(): string {
  const sample = TEMPLATE_COLUMNS.map((c) =>
    c === "linkedin_url" ? "https://www.linkedin.com/in/example-profile/" :
    c === "sales_nav_url" ? "" :
    c === "email" ? "jane@acme.com" :
    SAMPLE_VALUES[c as EditableField]
  );
  // Add UTF-8 BOM so Excel and Mac editors (Nova/Numbers) force UTF-8 instead of ASCII/Latin fallback
  return "\uFEFF" + Papa.unparse({ fields: [...TEMPLATE_COLUMNS], data: [sample] });
}

export interface CsvImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeLinkedinUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || !trimmed.includes("linkedin.com/in/")) return null;
  return trimmed;
}

interface ParsedRow {
  linkedin_url: string | null;
  sales_nav_url: string | null;
  email: string | null;
  full_name: string | null;
  fields: Record<EditableField, string | null>;
}



class CrmStatusResolver {
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
}

function get(row: Record<string, string>, key: string): string | null {
  const v = row[key];
  const t = typeof v === "string" ? v.trim() : "";
  return t.length > 0 ? t : null;
}

export function importCsv(db: DB, listId: string, csvText: string): CsvImportResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  const statusResolver = new CrmStatusResolver(db);
  const errors: string[] = [];
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  const rows: ParsedRow[] = [];
  parsed.data.forEach((raw, idx) => {
    const rowNum = idx + 2; // header is row 1
    const fields = Object.fromEntries(EDITABLE_FIELDS.map((f) => [f, get(raw, f)])) as Record<EditableField, string | null>;
    if (fields.lead_status) {
      const resolved = statusResolver.resolve(fields.lead_status);
      if (resolved) fields.lead_status = resolved;
    }
    const full_name = [fields.first_name, fields.last_name].filter(Boolean).join(" ") || null;

    const rawUrl = get(raw, "linkedin_url");
    const linkedin_url = rawUrl ? normalizeLinkedinUrl(rawUrl) : null;
    if (rawUrl && !linkedin_url) { errors.push(`Row ${rowNum}: "${rawUrl}" is not a valid linkedin.com/in/ URL`); return; }

    const sales_nav_url = get(raw, "sales_nav_url");

    const rawEmail = get(raw, "email");
    let email: string | null = null;
    if (rawEmail) {
      if (!EMAIL_RE.test(rawEmail)) { errors.push(`Row ${rowNum}: "${rawEmail}" is not a valid email`); return; }
      email = rawEmail.toLowerCase();
    }

    if (!linkedin_url && !email) {
      errors.push(`Row ${rowNum}: needs at least a linkedin_url or an email`);
      return;
    }

    rows.push({ linkedin_url, sales_nav_url, email, full_name, fields });
  });

  const editableCols = [...EDITABLE_FIELDS, "full_name", "sales_nav_url"] as const;

  const insertByLinkedin = db.prepare(`
    INSERT INTO targets (id, linkedin_url, email, sales_nav_url, full_name, ${EDITABLE_FIELDS.join(", ")})
    VALUES (?, ?, ?, ?, ?, ${EDITABLE_FIELDS.map(() => "?").join(", ")})
    ON CONFLICT(linkedin_url) DO UPDATE SET
      email = COALESCE(excluded.email, targets.email),
      ${editableCols.map((c) => `${c} = COALESCE(excluded.${c}, targets.${c})`).join(",\n      ")}
  `);
  const findByLinkedin = db.prepare("SELECT id FROM targets WHERE linkedin_url = ?");
  const findByEmail = db.prepare("SELECT id FROM targets WHERE email = ? LIMIT 1");
  const insertByEmail = db.prepare(`
    INSERT INTO targets (id, email, full_name, ${EDITABLE_FIELDS.join(", ")}, sales_nav_url)
    VALUES (?, ?, ?, ${EDITABLE_FIELDS.map(() => "?").join(", ")}, ?)
  `);
  const updateByEmail = db.prepare(`
    UPDATE targets SET
      ${editableCols.map((c) => `${c} = COALESCE(?, ${c})`).join(",\n      ")}
    WHERE id = ?
  `);
  const linkToList = db.prepare("INSERT OR IGNORE INTO list_targets (list_id, target_id) VALUES (?, ?)");

  statusResolver.flush();

  db.transaction(() => {
    for (const row of rows) {
      let targetId: string;
      let isNew: boolean;
      const fieldValues = EDITABLE_FIELDS.map((f) => row.fields[f]);

      if (row.linkedin_url) {
        const existing = findByLinkedin.get(row.linkedin_url) as { id: string } | undefined;
        isNew = !existing;
        targetId = existing?.id ?? randomUUID();
        insertByLinkedin.run(targetId, row.linkedin_url, row.email, row.sales_nav_url, row.full_name, ...fieldValues);
      } else {
        const existing = findByEmail.get(row.email) as { id: string } | undefined;
        isNew = !existing;
        if (existing) {
          targetId = existing.id;
          updateByEmail.run(...fieldValues, row.full_name, row.sales_nav_url, targetId);
        } else {
          targetId = randomUUID();
          insertByEmail.run(targetId, row.email, row.full_name, ...fieldValues, row.sales_nav_url);
        }
      }

      const linkResult = linkToList.run(listId, targetId);
      if (linkResult.changes > 0) {
        if (isNew) imported++; else updated++;
      } else {
        skipped++; // already in this list, no changes
      }
    }
  })();

  return { imported, updated, skipped, errors };
}
