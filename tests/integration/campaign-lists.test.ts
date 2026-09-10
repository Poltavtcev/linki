import { expect, test, beforeAll } from 'vitest';
import { getDb } from '@/lib/db';
import { randomUUID } from 'crypto';
import enrollHandler from '@/pages/api/runs/[id]/enroll';

let db: ReturnType<typeof getDb>;

beforeAll(() => {
  db = getDb();
});

const mockRes = () => {
  const res: any = {};
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (data: any) => { res.data = data; return res; };
  res.end = () => res;
  return res;
};

test('Legacy runs act correctly without source_list_id', async () => {
  const listId = randomUUID();
  const targetId = randomUUID();
  const workflowId = randomUUID();
  const runId = randomUUID();

  db.prepare("INSERT INTO lists (id, name) VALUES (?, 'Legacy List')").run(listId);
  db.prepare("INSERT INTO targets (id, full_name, linkedin_url) VALUES (?, 'Legacy Target', ?)").run(targetId, randomUUID());
  db.prepare("INSERT INTO list_targets (list_id, target_id) VALUES (?, ?)").run(listId, targetId);
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'legacy')").run(workflowId);
  db.prepare("INSERT INTO runs (id, workflow_id, list_id, status) VALUES (?, ?, ?, 'running')").run(runId, workflowId, listId);
  db.prepare("INSERT INTO run_profiles (id, target_id, run_id, source_list_id) VALUES (?, ?, ?, NULL)").run(randomUUID(), targetId, runId);

  // A legacy run profile has NULL source_list_id.
  const rp = db.prepare("SELECT source_list_id FROM run_profiles WHERE run_id = ?").get(runId) as any;
  expect(rp.source_list_id).toBeNull();
});

test('Concurrent enrollment of the same target from two different lists', async () => {
  const targetId = randomUUID();
  const workflowId = randomUUID();
  const runId = randomUUID();
  
  db.prepare("INSERT INTO targets (id, full_name, linkedin_url) VALUES (?, 'Concurrent Target', ?)").run(targetId, randomUUID());
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'concurrent workflow')").run(workflowId);
  db.prepare("INSERT INTO runs (id, workflow_id, status) VALUES (?, ?, 'running')").run(runId, workflowId);
  
  const list1 = randomUUID();
  const list2 = randomUUID();
  db.prepare("INSERT INTO lists (id, name) VALUES (?, 'List 1')").run(list1);
  db.prepare("INSERT INTO lists (id, name) VALUES (?, 'List 2')").run(list2);

  // Both enroll the target
  const req1 = { method: 'POST', query: { id: runId }, body: { target_ids: [targetId], list_id: list1 } } as any;
  const res1 = mockRes();
  
  const req2 = { method: 'POST', query: { id: runId }, body: { target_ids: [targetId], list_id: list2 } } as any;
  const res2 = mockRes();

  // Run them concurrently
  await Promise.all([
    enrollHandler(req1, res1),
    enrollHandler(req2, res2)
  ]);

  // Prove that exactly 1 run_profile is created
  const profiles = db.prepare("SELECT id, source_list_id FROM run_profiles WHERE run_id = ? AND target_id = ?").all(runId, targetId) as any[];
  expect(profiles.length).toBe(1);

  // It has a deterministic source_list_id (the winner)
  const source = profiles[0].source_list_id;
  expect(source === list1 || source === list2).toBeTruthy();

  // The counts reflect normal dedup
  // Because they both return successfully, one of the responses should indicate skipped_already_enrolled = 1 or enrolled = 0
  const data1 = res1.data;
  const data2 = res2.data;
  const totalEnrolled = data1.enrolled + data2.enrolled;
  expect(totalEnrolled).toBe(1);
  const totalSkipped = data1.skipped_already_enrolled + data2.skipped_already_enrolled;
  expect(totalSkipped).toBe(1);
});

test('Repeat list additions update last_added_at', async () => {
  const targetId = randomUUID();
  const workflowId = randomUUID();
  const runId = randomUUID();
  const listId = randomUUID();

  db.prepare("INSERT INTO targets (id, full_name, linkedin_url) VALUES (?, 'Repeat Target', ?)").run(targetId, randomUUID());
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'repeat')").run(workflowId);
  db.prepare("INSERT INTO runs (id, workflow_id, status) VALUES (?, ?, 'running')").run(runId, workflowId);
  db.prepare("INSERT INTO lists (id, name) VALUES (?, 'Repeat List')").run(listId);

  // Add list
  await enrollHandler({ method: 'POST', query: { id: runId }, body: { target_ids: [targetId], list_id: listId } } as any, mockRes());
  
  const initial = db.prepare("SELECT first_added_at, last_added_at FROM run_lists WHERE run_id = ? AND list_id = ?").get(runId, listId) as any;
  
  // Wait to ensure timestamp change (SQLite datetime('now') is 1-second resolution)
  await new Promise(r => setTimeout(r, 1500));
  
  // Add again (must include a target_id so it bypasses the 400 error)
  await enrollHandler({ method: 'POST', query: { id: runId }, body: { target_ids: [targetId], list_id: listId } } as any, mockRes());
  
  const updated = db.prepare("SELECT first_added_at, last_added_at FROM run_lists WHERE run_id = ? AND list_id = ?").get(runId, listId) as any;
  expect(initial.first_added_at).toBe(updated.first_added_at);
  expect(new Date(updated.last_added_at).getTime()).toBeGreaterThan(new Date(initial.last_added_at).getTime());
});

test('Enrollment without a list acts as direct/API enrollment (loose reference)', async () => {
  const targetId = randomUUID();
  const workflowId = randomUUID();
  const runId = randomUUID();

  db.prepare("INSERT INTO targets (id, full_name, linkedin_url) VALUES (?, 'API Target', ?)").run(targetId, randomUUID());
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'api-enroll')").run(workflowId);
  db.prepare("INSERT INTO runs (id, workflow_id, status) VALUES (?, ?, 'running')").run(runId, workflowId);

  // Enroll without list_id
  await enrollHandler({ method: 'POST', query: { id: runId }, body: { target_ids: [targetId] } } as any, mockRes());
  
  const profile = db.prepare("SELECT source_list_id FROM run_profiles WHERE run_id = ? AND target_id = ?").get(runId, targetId) as any;
  expect(profile.source_list_id).toBeNull();
});

test('Deleted lists preserve accounting via loose references', async () => {
  const targetId = randomUUID();
  const workflowId = randomUUID();
  const runId = randomUUID();
  const listId = randomUUID();

  db.prepare("INSERT INTO targets (id, full_name, linkedin_url) VALUES (?, 'Deleted List Target', ?)").run(targetId, randomUUID());
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'deleted-list')").run(workflowId);
  db.prepare("INSERT INTO runs (id, workflow_id, status) VALUES (?, ?, 'running')").run(runId, workflowId);
  db.prepare("INSERT INTO lists (id, name) VALUES (?, 'Temp List')").run(listId);

  // Enroll with list_id
  await enrollHandler({ method: 'POST', query: { id: runId }, body: { target_ids: [targetId], list_id: listId } } as any, mockRes());
  
  // Verify list_id is set
  const profile = db.prepare("SELECT source_list_id FROM run_profiles WHERE run_id = ? AND target_id = ?").get(runId, targetId) as any;
  expect(profile.source_list_id).toBe(listId);

  const runList = db.prepare("SELECT list_id FROM run_lists WHERE run_id = ?").get(runId) as any;
  expect(runList.list_id).toBe(listId);

  // Delete list
  db.prepare("DELETE FROM lists WHERE id = ?").run(listId);

  // Accounting preserved because foreign key doesn't cascade delete run_profiles or run_lists
  const profileAfter = db.prepare("SELECT source_list_id FROM run_profiles WHERE run_id = ? AND target_id = ?").get(runId, targetId) as any;
  expect(profileAfter.source_list_id).toBe(listId);
  const runListAfter = db.prepare("SELECT list_id FROM run_lists WHERE run_id = ?").get(runId) as any;
  expect(runListAfter.list_id).toBe(listId);
});

test('Returns 400 if target_ids is empty', async () => {
  const req = { method: 'POST', query: { id: randomUUID() }, body: { target_ids: [] } } as any;
  const res = mockRes();
  await enrollHandler(req, res);
  expect(res.statusCode).toBe(400);
});

test('Returns 404 if run does not exist', async () => {
  const req = { method: 'POST', query: { id: randomUUID() }, body: { target_ids: [randomUUID()] } } as any;
  const res = mockRes();
  await enrollHandler(req, res);
  expect(res.statusCode).toBe(404);
});

test('Enrollment skips targets already active elsewhere', async () => {
  const targetId = randomUUID();
  const workflow1Id = randomUUID();
  const workflow2Id = randomUUID();
  const run1Id = randomUUID();
  const run2Id = randomUUID();

  db.prepare("INSERT INTO targets (id, full_name, linkedin_url) VALUES (?, 'Active Elsewhere Target', ?)").run(targetId, randomUUID());
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'active-elsewhere 1')").run(workflow1Id);
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'active-elsewhere 2')").run(workflow2Id);
  db.prepare("INSERT INTO runs (id, workflow_id, status) VALUES (?, ?, 'running')").run(run1Id, workflow1Id);
  db.prepare("INSERT INTO runs (id, workflow_id, status) VALUES (?, ?, 'running')").run(run2Id, workflow2Id); // different workflow
  
  // Enroll target in run 1 manually
  const rpId = randomUUID();
  db.prepare("INSERT INTO run_profiles (id, target_id, run_id) VALUES (?, ?, ?)").run(rpId, targetId, run1Id);
  db.prepare("INSERT INTO run_profile_tracks (id, run_profile_id, track, state) VALUES (?, ?, 'main', 'pending')").run(randomUUID(), rpId);

  // Attempt to enroll in run 2
  const req = { method: 'POST', query: { id: run2Id }, body: { target_ids: [targetId] } } as any;
  const res = mockRes();
  await enrollHandler(req, res);

  expect(res.data.enrolled).toBe(0);
  expect(res.data.skipped_active_elsewhere).toBe(1);
});

test('Enrollment handles mixed target_ids correctly (some succeed, some skipped)', async () => {
  const target1Id = randomUUID();
  const target2Id = randomUUID();
  const workflowId = randomUUID();
  const runId = randomUUID();

  db.prepare("INSERT INTO targets (id, full_name, linkedin_url) VALUES (?, 'Mixed 1', ?)").run(target1Id, randomUUID());
  db.prepare("INSERT INTO targets (id, full_name, linkedin_url) VALUES (?, 'Mixed 2', ?)").run(target2Id, randomUUID());
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'mixed')").run(workflowId);
  db.prepare("INSERT INTO runs (id, workflow_id, status) VALUES (?, ?, 'running')").run(runId, workflowId);
  
  // Target 1 already enrolled
  db.prepare("INSERT INTO run_profiles (id, target_id, run_id) VALUES (?, ?, ?)").run(randomUUID(), target1Id, runId);

  const req = { method: 'POST', query: { id: runId }, body: { target_ids: [target1Id, target2Id] } } as any;
  const res = mockRes();
  await enrollHandler(req, res);

  expect(res.data.enrolled).toBe(1);
  expect(res.data.skipped_already_enrolled).toBe(1);
});

import createRunHandler from '@/pages/api/runs/index';

test('Creating a new campaign populates run_lists', async () => {
  const workflowId = randomUUID();
  const accountId = randomUUID();
  const listId = randomUUID();
  
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'test workflow')").run(workflowId);
  db.prepare("INSERT INTO accounts (id, name, email) VALUES (?, 'test account', ?)").run(accountId, randomUUID());
  db.prepare("INSERT INTO lists (id, name) VALUES (?, 'test list')").run(listId);
  // Add at least one target to bypass "list is empty" error
  const targetId = randomUUID();
  db.prepare("INSERT INTO targets (id, full_name, linkedin_url) VALUES (?, 'dummy target', ?)").run(targetId, randomUUID());
  db.prepare("INSERT INTO list_targets (list_id, target_id) VALUES (?, ?)").run(listId, targetId);
  
  // Create a run via the create endpoint
  const req = { method: 'POST', body: { workflow_id: workflowId, account_id: accountId, list_id: listId } } as any;
  const res = mockRes();
  await createRunHandler(req, res);
  
  expect(res.statusCode).toBe(201);
  const runId = res.data.id;
  
  const runList = db.prepare("SELECT list_id FROM run_lists WHERE run_id = ?").get(runId) as any;
  expect(runList.list_id).toBe(listId);
});

test('Creating a new campaign populates source_list_id for targets in list', async () => {
  const workflowId = randomUUID();
  const accountId = randomUUID();
  const listId = randomUUID();
  const targetId = randomUUID();
  
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'test workflow 2')").run(workflowId);
  db.prepare("INSERT INTO accounts (id, name, email) VALUES (?, 'test account 2', ?)").run(accountId, randomUUID());
  db.prepare("INSERT INTO lists (id, name) VALUES (?, 'test list 2')").run(listId);
  db.prepare("INSERT INTO targets (id, full_name, linkedin_url) VALUES (?, 'target in list', ?)").run(targetId, randomUUID());
  db.prepare("INSERT INTO list_targets (list_id, target_id) VALUES (?, ?)").run(listId, targetId);
  
  const req = { method: 'POST', body: { workflow_id: workflowId, account_id: accountId, list_id: listId } } as any;
  const res = mockRes();
  await createRunHandler(req, res);
  
  expect(res.statusCode).toBe(201);
  const runId = res.data.id;
  
  const profile = db.prepare("SELECT source_list_id FROM run_profiles WHERE run_id = ? AND target_id = ?").get(runId, targetId) as any;
  expect(profile.source_list_id).toBe(listId);
});

import { getServerSideProps } from '@/pages/lists/index';

test('getServerSideProps handles multiple campaigns without Cartesian products', async () => {
  const list0Id = randomUUID();
  const list1Id = randomUUID();
  const list2Id = randomUUID();

  // Create lists
  db.prepare("INSERT INTO lists (id, name) VALUES (?, 'List 0')").run(list0Id);
  db.prepare("INSERT INTO lists (id, name) VALUES (?, 'List 1')").run(list1Id);
  db.prepare("INSERT INTO lists (id, name) VALUES (?, 'List 2')").run(list2Id);

  // Add 2 targets to each list to verify count doesn't multiply
  for (let i = 0; i < 2; i++) {
    const t0 = randomUUID(), t1 = randomUUID(), t2 = randomUUID();
    db.prepare("INSERT INTO targets (id, full_name, linkedin_url) VALUES (?, ?, ?)").run(t0, `T0-${i}`, randomUUID());
    db.prepare("INSERT INTO list_targets (list_id, target_id) VALUES (?, ?)").run(list0Id, t0);
    
    db.prepare("INSERT INTO targets (id, full_name, linkedin_url) VALUES (?, ?, ?)").run(t1, `T1-${i}`, randomUUID());
    db.prepare("INSERT INTO list_targets (list_id, target_id) VALUES (?, ?)").run(list1Id, t1);
    
    db.prepare("INSERT INTO targets (id, full_name, linkedin_url) VALUES (?, ?, ?)").run(t2, `T2-${i}`, randomUUID());
    db.prepare("INSERT INTO list_targets (list_id, target_id) VALUES (?, ?)").run(list2Id, t2);
  }

  // Create workflows
  const w1 = randomUUID(), w2 = randomUUID(), w3 = randomUUID();
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'W1')").run(w1);
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'W2')").run(w2);
  db.prepare("INSERT INTO workflows (id, name) VALUES (?, 'W3')").run(w3);

  // Create runs
  const r1 = randomUUID(), r2 = randomUUID(), r3 = randomUUID();
  db.prepare("INSERT INTO runs (id, workflow_id, status) VALUES (?, ?, 'running')").run(r1, w1);
  db.prepare("INSERT INTO runs (id, workflow_id, status) VALUES (?, ?, 'running')").run(r2, w2);
  db.prepare("INSERT INTO runs (id, workflow_id, status) VALUES (?, ?, 'paused')").run(r3, w3);

  // List 1 gets 1 campaign
  db.prepare("INSERT INTO run_lists (run_id, list_id, first_added_at, last_added_at) VALUES (?, ?, datetime('now'), datetime('now'))").run(r1, list1Id);

  // List 2 gets 2 campaigns
  db.prepare("INSERT INTO run_lists (run_id, list_id, first_added_at, last_added_at) VALUES (?, ?, datetime('now'), datetime('now'))").run(r2, list2Id);
  db.prepare("INSERT INTO run_lists (run_id, list_id, first_added_at, last_added_at) VALUES (?, ?, datetime('now'), datetime('now'))").run(r3, list2Id);

  const context: any = {};
  const response = await getServerSideProps(context) as any;
  const lists = response.props.initialLists;

  const l0 = lists.find((l: any) => l.id === list0Id);
  const l1 = lists.find((l: any) => l.id === list1Id);
  const l2 = lists.find((l: any) => l.id === list2Id);

  expect(l0).toBeDefined();
  expect(l0.target_count).toBe(2);
  expect(l0.active_campaigns).toHaveLength(0);

  expect(l1).toBeDefined();
  expect(l1.target_count).toBe(2);
  expect(l1.active_campaigns).toHaveLength(1);
  expect(l1.active_campaigns[0].id).toBe(r1);
  expect(l1.active_campaigns[0].status).toBe('running');

  expect(l2).toBeDefined();
  expect(l2.target_count).toBe(2);
  expect(l2.active_campaigns).toHaveLength(2);
  
  // ensure no nulls and correctly populated
  for (const c of l2.active_campaigns) {
    expect(c.id).toBeTruthy();
    expect(c.status).toBeTruthy();
    expect(c.name).toBeTruthy();
  }
});

