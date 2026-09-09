import { getDb } from '../lib/db';
const db = getDb();
console.log("Triggers in DB:");
console.log(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all());
