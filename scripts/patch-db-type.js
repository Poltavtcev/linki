const fs = require('fs');
let code = fs.readFileSync('lib/db.ts', 'utf8');

const oldCode = \`    const tableInfo = db.prepare("PRAGMA foreign_key_list(run_profiles)").all();
    const hasCascade = tableInfo.some(fk => fk.table === 'targets' && fk.on_delete === 'CASCADE');\`;

const newCode = \`    const tableInfo = db.prepare("PRAGMA foreign_key_list(run_profiles)").all() as { table: string; on_delete: string }[];
    const hasCascade = tableInfo.some(fk => fk.table === 'targets' && fk.on_delete === 'CASCADE');\`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('lib/db.ts', code);
