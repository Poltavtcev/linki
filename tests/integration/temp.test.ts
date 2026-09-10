import { test, expect } from 'vitest';
import { getDb } from '@/lib/db';

test('run_profiles schema', () => {
  const db = getDb();
  const info = db.prepare("PRAGMA table_info(run_profiles)").all();
  console.log(info);
});
