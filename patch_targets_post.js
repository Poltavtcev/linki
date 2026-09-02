const fs = require('fs');
let code = fs.readFileSync('pages/api/targets/index.ts', 'utf8');

const targetPost = `const { full_name, linkedin_url, title, company, location, email, phone, list_id } = req.body;
    if (!full_name || !linkedin_url) {
      return res.status(400).json({ error: "full_name and linkedin_url are required" });
    }`;

const newPost = `const { first_name, last_name, linkedin_url, title, company, location, email, phone, list_id } = req.body;
    if (!first_name || !linkedin_url) {
      return res.status(400).json({ error: "first_name and linkedin_url are required" });
    }
    const full_name = \`\${first_name} \${last_name || ""}\`.trim();`;

code = code.replace(targetPost, newPost);

const targetInsert = `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      \`, [id, full_name, linkedin_url, title || null, company || null, location || null, email || null, phone || null, new Date().toISOString()]);`;

const newInsert = `VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      \`, [id, first_name, last_name || null, full_name, linkedin_url, title || null, company || null, location || null, email || null, phone || null, new Date().toISOString()]);`;

code = code.replace(/full_name, linkedin_url, title, company, location, email, phone, created_at\)/, 'first_name, last_name, full_name, linkedin_url, title, company, location, email, phone, created_at)');
code = code.replace(targetInsert, newInsert);

fs.writeFileSync('pages/api/targets/index.ts', code);
