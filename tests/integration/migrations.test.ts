import { test, expect } from 'vitest';
import { getDb } from '@/lib/db';

test('Fresh DB: schema and migrations', () => {
  const db = getDb();

  // getDb() automatically runs initDb and runMigrations on a fresh in-memory DB

  // Assert outbound_events exists
  const tableInfo = db.prepare("PRAGMA table_info(outbound_events)").all() as any[];
  expect(tableInfo.length).toBeGreaterThan(0);
  const statusCol = tableInfo.find(c => c.name === 'status');
  expect(statusCol).toBeDefined();

  // Assert outbound_events indexes exist
  const indexInfo = db.prepare("PRAGMA index_list(outbound_events)").all() as any[];
  const idxRunProfile = indexInfo.find(i => i.name === 'idx_outbound_events_run_profile');
  expect(idxRunProfile).toBeDefined();
  
  // Assert trigger sync_run_profile_tracks_state exists
  const trigger = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name='sync_run_profile_tracks_state'").get() as { name: string } | undefined;
  expect(trigger?.name).toBe('sync_run_profile_tracks_state');
});
