const fs = require('fs');

function patchFile(filepath) {
  let code = fs.readFileSync(filepath, 'utf8');
  
  if (filepath.includes('[id].ts')) {
    code = code.replace(
      /\/\/ Some references \(run_profiles, logs\) have no ON DELETE CASCADE — clear them first so the\s*\n\s*\/\/ FK constraint doesn't block the delete. run_profile_tracks cascade off run_profiles\.\s*\n\s*db\.transaction\(\(\) => \{\s*\n\s*db\.prepare\("DELETE FROM run_profiles WHERE target_id = \?"\)\.run\(id\);\s*\n\s*db\.prepare\("DELETE FROM logs WHERE target_id = \?"\)\.run\(id\);\s*\n\s*db\.prepare\("DELETE FROM targets WHERE id = \?"\)\.run\(id\);\s*\n\s*\}\)\(\);/g,
      `db.transaction(() => {
      db.prepare("DELETE FROM targets WHERE id = ?").run(id);
    })();`
    );
  } else {
    code = code.replace(
      /\/\/ run_profiles\/logs have no ON DELETE CASCADE — clear them first so the FK\s*\n\s*\/\/ constraint doesn't block the delete\. run_profile_tracks cascade off run_profiles\.\s*\n\s*const result = db\.transaction\(\(\) => \{\s*\n\s*db\.prepare\(\`DELETE FROM run_profiles WHERE target_id IN \(\$\{placeholders\}\)\`\)\.run\(\.\.\.target_ids\);\s*\n\s*db\.prepare\(\`DELETE FROM logs WHERE target_id IN \(\$\{placeholders\}\)\`\)\.run\(\.\.\.target_ids\);\s*\n\s*return db\.prepare\(\`DELETE FROM targets WHERE id IN \(\$\{placeholders\}\)\`\)\.run\(\.\.\.target_ids\);\s*\n\s*\}\)\(\);/g,
      `const result = db.transaction(() => {
      return db.prepare(\`DELETE FROM targets WHERE id IN (\${placeholders})\`).run(...target_ids);
    })();`
    );
  }
  
  fs.writeFileSync(filepath, code);
}

patchFile('pages/api/targets/[id].ts');
patchFile('pages/api/targets/index.ts');
