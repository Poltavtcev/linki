import Database from 'better-sqlite3';

const db = new Database(':memory:');
db.exec(`
  CREATE TABLE run_profiles (id TEXT PRIMARY KEY);
  CREATE TABLE run_profile_states (run_profile_id TEXT PRIMARY KEY REFERENCES run_profiles(id) ON DELETE CASCADE, state TEXT);
  CREATE TABLE run_profile_tracks (run_profile_id TEXT, state TEXT);
  CREATE TRIGGER sync_t AFTER UPDATE OF state ON run_profile_states
  BEGIN
    UPDATE run_profile_tracks SET state = NEW.state;
  END;
`);

console.log("Before Drop:", db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all());
db.exec(`
  PRAGMA foreign_keys = OFF;
  DROP TABLE run_profiles;
  PRAGMA foreign_keys = ON;
`);
console.log("After Drop run_profiles:", db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all());
