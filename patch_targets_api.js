const fs = require('fs');

let apiCode = fs.readFileSync('pages/api/targets/[id].ts', 'utf8');

if (!apiCode.includes('"linkedin_url"')) {
  apiCode = apiCode.replace(
    /const EDITABLE = \[\s*"first_name", "last_name", "lead_status", "full_name", "title", "company", "location",\s*"city", "country", "time_zone", "seniority",\s*"email", "phone", "headline", "summary", "notes", "company_id",\s*\] as const;/,
    `const EDITABLE = [
      "first_name", "last_name", "lead_status", "full_name", "title", "company", "location",
      "city", "country", "time_zone", "seniority",
      "email", "phone", "headline", "summary", "notes", "company_id",
      "linkedin_url"
    ] as const;`
  );
  
  // Wrap db.prepare(...).run() in a try-catch for unique constraint
  apiCode = apiCode.replace(
    `    db.prepare(\`UPDATE targets SET \${fields.join(", ")} WHERE id = ?\`).run(...params);`,
    `    try {
      db.prepare(\`UPDATE targets SET \${fields.join(", ")} WHERE id = ?\`).run(...params);
    } catch (err: any) {
      if (err.code === "SQLITE_CONSTRAINT_UNIQUE" && err.message.includes("linkedin_url")) {
        return res.status(409).json({ error: "Another contact with this LinkedIn URL already exists." });
      }
      throw err;
    }`
  );
  
  fs.writeFileSync('pages/api/targets/[id].ts', apiCode);
}
