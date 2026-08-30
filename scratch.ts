import sqlite3 from "better-sqlite3";
const db = sqlite3("linki.db");
const row = db.prepare("SELECT cookies_json FROM accounts WHERE id = '2191d540-1920-48da-8048-d868693c8b96'").get();
// The cookies are encrypted using AES.
// We can just query them from the db if we use the proxy or decryption function.
