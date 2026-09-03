const db = require('better-sqlite3')('database/linki.db');
const stats = db.prepare("SELECT message, count(*) as c FROM logs GROUP BY message ORDER BY c DESC LIMIT 10").all();
console.log(stats);
