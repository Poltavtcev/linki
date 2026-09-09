process.env.LINKI_DB_PATH = ':memory:';

export default async function setup() {
  const { getDb } = await import('@/lib/db');

  const db = getDb();
  const list = db.prepare('PRAGMA database_list').all() as any[];
  const mainDb = list.find((db) => db.name === 'main');

  if (mainDb && mainDb.file && mainDb.file.endsWith('linki.db')) {
    console.error("CRITICAL ERROR: Tests are running against the production/default linki.db file!");
    process.exit(1);
  }
}
setup();
