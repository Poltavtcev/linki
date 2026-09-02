const fs = require('fs');
let code = fs.readFileSync('pages/api/targets/index.ts', 'utf8');

const targetInsert = `INSERT INTO targets (id, full_name, linkedin_url, title, company, location, email, phone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
const newInsert = `INSERT INTO targets (id, first_name, last_name, full_name, linkedin_url, title, company, location, email, phone, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

code = code.replace(targetInsert, newInsert);

const targetRun = `.run(id, full_name, linkedin_url, title ?? null, company ?? null, location ?? null, email ?? null, phone ?? null);`;
const newRun = `.run(id, first_name, last_name || null, full_name, linkedin_url, title ?? null, company ?? null, location ?? null, email ?? null, phone ?? null, new Date().toISOString());`;

code = code.replace(targetRun, newRun);

fs.writeFileSync('pages/api/targets/index.ts', code);
