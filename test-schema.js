const Database = require("better-sqlite3");
const db = new Database("linki.db");
db.pragma("foreign_keys = ON");

try {
    db.prepare("UPDATE runs SET account_id = NULL WHERE account_id = 'foo'").run();
    console.log("Can set to NULL");
} catch (e) {
    console.log(e);
}
