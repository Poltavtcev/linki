const fs = require('fs');

// 1. Patch lib/csv-import.ts
let csvCode = fs.readFileSync('lib/csv-import.ts', 'utf8');

csvCode = csvCode.replace(
  /const EDITABLE_FIELDS = \[\s*\"first_name\", \"last_name\", \"title\", \"company\", \"location\",\s*\"city\", \"country\", \"phone\", \"headline\", \"summary\", \"notes\",\s*\] as const;/,
  `const EDITABLE_FIELDS = [
  "first_name", "last_name", "title", "company", "location",
  "city", "country", "time_zone", "phone", "headline", "summary", "notes",
  "lead_status", "seniority"
] as const;`
);

csvCode = csvCode.replace(
  `  notes: "Met at SaaStr 2026",\n};`,
  `  notes: "Met at SaaStr 2026",
  time_zone: "Europe/Berlin",
  lead_status: "lead",
  seniority: "Director",
};`
);

fs.writeFileSync('lib/csv-import.ts', csvCode);

// 2. Patch pages/api/targets/[id].ts
let apiCode = fs.readFileSync('pages/api/targets/[id].ts', 'utf8');
apiCode = apiCode.replace(
  /const EDITABLE = \[\s*"first_name", "last_name", "lead_status", "full_name", "title", "company", "location",\s*"email", "phone", "headline", "summary", "notes", "company_id",\s*\] as const;/,
  `const EDITABLE = [
      "first_name", "last_name", "lead_status", "full_name", "title", "company", "location",
      "city", "country", "time_zone", "seniority",
      "email", "phone", "headline", "summary", "notes", "company_id",
    ] as const;`
);

fs.writeFileSync('pages/api/targets/[id].ts', apiCode);
