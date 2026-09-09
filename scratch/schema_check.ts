import Database from 'better-sqlite3';

const db = new Database('linki.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];

const targets = ['outbound', 'message', 'email', 'reply', 'run'];
for (const t of tables) {
  const tname = t.name;
  if (targets.some(x => tname.includes(x))) {
    const info = db.prepare(`PRAGMA table_info(${tname})`).all() as any[];
    console.log(`\nTable: ${tname}`);
    console.log(info.map(c => `  ${c.name} (${c.type})`).join('\n'));
  }
}
