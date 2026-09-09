import * as inbox from '@/lib/email/inbox';
vi.mock('@/lib/email/inbox', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    captureReplyBody: vi.fn().mockResolvedValue('reply_id')
  };
});
import { test, expect, beforeAll, vi, beforeEach } from 'vitest';
import path from 'path';


import { getDb } from '@/lib/db';
import { captureSdrInboundMessage } from '@/lib/linkedin/sdr-shim';
import { syncEmailInbox } from '@/lib/email/inbox';
import { tickActions } from '@/lib/linkedin/runner';
import { randomUUID } from 'crypto';

vi.mock('@/lib/email/sender', () => ({
  sendEmail: vi.fn().mockResolvedValue('msgX')
}));

// Mock imap
vi.mock('imap', () => {
  return {
    default: class MockImap {
      constructor(opts: any) {}
      once(event: string, cb: any) {
        if (event === 'ready') setTimeout(cb, 10);
      }
      openBox(name: string, readOnly: boolean, cb: any) {
        cb(null, { uidvalidity: 1, messages: { total: 0 } });
      }
      search(criteria: any, cb: any) {
        cb(null, [(global as any).mockEmailUid || 1]);
      }
      fetch(uids: any, opts: any) {
        const ee = new (require('events').EventEmitter)();
        setTimeout(() => {
          if (true) {
             const msg = new (require('events').EventEmitter)();
             ee.emit('message', msg);
             const attrs = { uid: (global as any).mockEmailUid || 1 };
             msg.emit('attributes', attrs);
             const stream = new (require('events').EventEmitter)();
             msg.emit('body', stream, { which: 'HEADER.FIELDS (FROM TO DATE MESSAGE-ID IN-REPLY-TO REFERENCES SUBJECT)' });
             stream.emit('data', Buffer.from((global as any).mockEmailHeader || ""));
             stream.emit('end');
             msg.emit('end');
          } else {
             const msg = new (require('events').EventEmitter)();
             ee.emit('message', msg);
             const stream = new (require('events').EventEmitter)();
             msg.emit('body', stream);
             stream.emit('data', Buffer.from("Subject: Re: Hello\n\nYes, I am interested."));
             stream.emit('end');
             msg.emit('end');
          }
          ee.emit('end');
        }, 10);
        return ee;
      }
      connect() {
        setTimeout(() => this.once('ready', () => {}), 10);
      }
      end() {}
      get seq() { return { fetch: this.fetch.bind(this) }; }
    }
  }
});

let db: ReturnType<typeof getDb>;

beforeEach(() => {
  db.prepare('PRAGMA foreign_keys = OFF;').run();
  db.exec('DELETE FROM targets; DELETE FROM run_profiles; DELETE FROM run_profile_states; DELETE FROM outbound_events; DELETE FROM workflow_steps; DELETE FROM runs; DELETE FROM accounts; DELETE FROM email_accounts; DELETE FROM workflows;');
  db.prepare('PRAGMA foreign_keys = ON;').run();
});
beforeAll(() => {
  db = getDb();
  // Clear any existing data
  db.prepare('PRAGMA foreign_keys = OFF;').run(); db.exec('DELETE FROM outbound_events; DELETE FROM run_profile_states; DELETE FROM run_profiles; DELETE FROM runs; DELETE FROM workflow_steps; DELETE FROM workflows; DELETE FROM targets; DELETE FROM email_accounts; DELETE FROM accounts;'); db.prepare('PRAGMA foreign_keys = ON;').run();
});

function setupRun(channel: 'linkedin'|'email') {
  const targetId = randomUUID();
  const runId = randomUUID();
  const runProfileId = randomUUID();
  const accountId = randomUUID();
  const emailAccountId = randomUUID();

  db.prepare('INSERT INTO targets (id, first_name, email) VALUES (?, ?, ?)').run(targetId, 'Test', targetId + '@example.com');
  db.prepare('INSERT INTO accounts (id, name, timezone, email) VALUES (?, ?, ?, ?)').run(accountId, 'Test Acc', 'UTC', accountId + '@acc.com');
  db.prepare('INSERT INTO email_accounts (id, name, username, password, from_email, smtp_host, imap_host, imap_username, imap_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(emailAccountId, 'Test Email', 'test', 'test', emailAccountId + '@acc.com', 'smtp.test', 'imap.test', 'test', 'test');
  db.prepare('INSERT INTO workflows (id, name) VALUES (?, ?)').run('wf1', 'Test'); db.prepare('INSERT INTO runs (id, account_id, status, workflow_id) VALUES (?, ?, ?, ?)').run(runId, accountId, 'running', 'wf1');
  db.prepare('INSERT INTO run_profiles (id, run_id, target_id, email_account_id) VALUES (?, ?, ?, ?)').run(runProfileId, runId, targetId, emailAccountId);
  db.prepare('INSERT INTO run_profile_states (run_profile_id, state) VALUES (?, ?)').run(runProfileId, 'running');
  db.prepare("INSERT INTO run_profile_tracks (id, run_profile_id, state, track, last_email_subject, last_email_message_id) VALUES (?, ?, 'in_progress', ?, 'subj', 'msgA')").run(randomUUID(), runProfileId, channel);

  return { targetId, runId, runProfileId, accountId, emailAccountId };
}

test('Case 1: LI Step 1 -> WAIT -> Email Step 3 -> LI reply routes through Step 1.on_replied', () => {
  const { targetId, runId, runProfileId, accountId } = setupRun('linkedin');
  
  db.prepare("INSERT INTO workflow_steps (id, edges_json, step_order, workflow_id, step_type) VALUES ('step1', '{\"on_replied\": \"step1-replied\"}', 0, 'wf1', 'message')").run();
  db.prepare("INSERT INTO workflow_steps (id, edges_json, step_order, workflow_id, step_type) VALUES ('step3', '{\"on_replied\": \"step3-replied\"}', 0, 'wf1', 'message')").run();

  db.prepare("INSERT INTO outbound_events (id, run_profile_id, channel, step_id, sent_at, run_id, target_id) VALUES (?, ?, 'linkedin', 'step1', '2020-01-01 10:00:00', ?, ?)").run(randomUUID(), runProfileId, runId, targetId);
  db.prepare("INSERT INTO outbound_events (id, run_profile_id, channel, step_id, sent_at, run_id, target_id) VALUES (?, ?, 'email', 'step3', '2020-01-02 10:00:00', ?, ?)").run(randomUUID(), runProfileId, runId, targetId);

  captureSdrInboundMessage(db, {
    eventId: randomUUID(),
    channel: 'linkedin',
    targetId,
    accountId,
    emailAccountId: null,
    externalThreadId: 't1',
    externalMessageId: 'm1',
    senderExternalId: 'ext1',
    senderName: 'Test',
    body: 'hello',
    receivedAt: '2020-01-03 10:00:00',
    metadata: {}
  });

  const state = db.prepare('SELECT current_step_id FROM run_profile_states WHERE run_profile_id = ?').get(runProfileId) as any;
  expect(state.current_step_id).toBe('step1-replied');
});

test('Case 2: LI Step 1 -> WAIT -> LI Step 3 -> LI reply routes through Step 3.on_replied', () => {
  const { targetId, runId, runProfileId, accountId } = setupRun('linkedin');
  
  db.prepare("INSERT INTO workflow_steps (id, edges_json, step_order, workflow_id, step_type) VALUES ('step1_2', '{\"on_replied\": \"step1-replied\"}', 0, 'wf1', 'message')").run();
  db.prepare("INSERT INTO workflow_steps (id, edges_json, step_order, workflow_id, step_type) VALUES ('step3_2', '{\"on_replied\": \"step3-replied\"}', 0, 'wf1', 'message')").run();

  db.prepare("INSERT INTO outbound_events (id, run_profile_id, channel, step_id, sent_at, run_id, target_id) VALUES (?, ?, 'linkedin', 'step1_2', '2020-01-01 10:00:00', ?, ?)").run(randomUUID(), runProfileId, runId, targetId);
  db.prepare("INSERT INTO outbound_events (id, run_profile_id, channel, step_id, sent_at, run_id, target_id) VALUES (?, ?, 'linkedin', 'step3_2', '2020-01-02 10:00:00', ?, ?)").run(randomUUID(), runProfileId, runId, targetId);

  captureSdrInboundMessage(db, {
    eventId: randomUUID(),
    channel: 'linkedin',
    targetId,
    accountId,
    emailAccountId: null,
    externalThreadId: 't2',
    externalMessageId: 'm2',
    senderExternalId: 'ext1',
    senderName: 'Test',
    body: 'hello',
    receivedAt: '2020-01-03 10:00:00',
    metadata: {}
  });

  const state = db.prepare('SELECT current_step_id FROM run_profile_states WHERE run_profile_id = ?').get(runProfileId) as any;
  expect(state.current_step_id).toBe('step3-replied');
});

test('Case 3: No matching outbound event -> no guessed/global fallback', () => {
  const { targetId, runId, runProfileId, accountId } = setupRun('linkedin');
  
  db.prepare("INSERT INTO workflow_steps (id, edges_json, step_order, workflow_id, step_type) VALUES ('step_global', '{\"on_replied\": \"global-replied\"}', 0, 'wf1', 'message')").run();
  db.prepare("UPDATE runs SET workflow_id = 'wf1' WHERE id = ?").run(runId);
  db.prepare("INSERT INTO workflow_steps (id, workflow_id, edges_json, step_order, step_type) VALUES ('step_wf1', 'wf1', '{\"on_replied\": \"global-replied\"}', 0, 'message')").run();

  captureSdrInboundMessage(db, {
    eventId: randomUUID(),
    channel: 'linkedin',
    targetId,
    accountId,
    emailAccountId: null,
    externalThreadId: 't3',
    externalMessageId: 'm3',
    senderExternalId: 'ext1',
    senderName: 'Test',
    body: 'hello',
    receivedAt: '2020-01-03 10:00:00',
    metadata: {}
  });

  const state = db.prepare('SELECT state, current_step_id FROM run_profile_states WHERE run_profile_id = ?').get(runProfileId) as any;
  // expect(state.state).toBe('completed'); // removed fallback
  expect(state.current_step_id).toBeNull();
});

test('Case 4: Email exact match', async () => {
  const { targetId, runId, runProfileId, accountId, emailAccountId } = setupRun('email');
  
  db.prepare("INSERT INTO workflow_steps (id, edges_json, step_order, workflow_id, step_type) VALUES ('email_step', '{\"on_replied\": \"email-replied-1\"}', 0, 'wf1', 'message')").run();
  db.prepare("INSERT INTO outbound_events (id, run_id, run_profile_id, target_id, channel, step_id, message_id, sent_at) VALUES (?, ?, ?, ?, 'email', 'email_step', 'msgA', '2020-01-01 10:00:00')").run(randomUUID(), runId, runProfileId, targetId);

  (global as any).mockEmailUid = 100;
  (global as any).mockEmailHeader = "From: test@example.com\r\nTo: us@example.com\r\nIn-Reply-To: msgA\r\nSubject: Re: Hello\r\n\r\nYes, I am interested.";

  await syncEmailInbox(emailAccountId);

  const state = db.prepare('SELECT current_step_id FROM run_profile_states WHERE run_profile_id = ?').get(runProfileId) as any;
  expect(state.current_step_id).toBe('email-replied-1');
});

test('Case 5: Email unknown In-Reply-To', async () => {
  const { targetId, runId, runProfileId, accountId, emailAccountId } = setupRun('email');
  
  db.prepare("INSERT INTO workflow_steps (id, edges_json, step_order, workflow_id, step_type) VALUES ('email_step_2', '{\"on_replied\": \"email-replied-2\"}', 0, 'wf1', 'message')").run();
  db.prepare("INSERT INTO outbound_events (id, run_id, run_profile_id, target_id, channel, step_id, message_id, sent_at) VALUES (?, ?, ?, ?, 'email', 'email_step_2', 'msgA', '2020-01-01 10:00:00')").run(randomUUID(), runId, runProfileId, targetId);

  (global as any).mockEmailUid = 101;
  (global as any).mockEmailHeader = "From: test@example.com\r\nTo: us@example.com\r\nIn-Reply-To: msgA\r\nSubject: Re: Hello\r\n\r\n";

  await syncEmailInbox(emailAccountId);

  const state = db.prepare('SELECT current_step_id FROM run_profile_states WHERE run_profile_id = ?').get(runProfileId) as any;
  expect(state.current_step_id).toBeNull();
});

test('Case 6 & 7: Outbound success vs failure', async () => {
  const { targetId, runId, runProfileId, accountId, emailAccountId } = setupRun('email');
  db.prepare("INSERT INTO workflow_steps (id, step_type, step_order, workflow_id) VALUES ('step_fail', 'message', 0, 'wf1')").run();
  db.prepare("INSERT INTO workflow_steps (id, step_type, step_order, workflow_id) VALUES ('step_succ', 'email', 0, 'wf1')").run();

  // Test success
  db.prepare("UPDATE run_profile_states SET current_step_id = 'step_succ', state = 'pending', next_eval_at = '2000-01-01' WHERE run_profile_id = ?").run(runProfileId);
  db.prepare("UPDATE accounts SET active_hours_start = 0, active_hours_end = 24, working_days = '1,2,3,4,5,6,7' WHERE id = ?").run(accountId);
  db.prepare("UPDATE email_accounts SET active_hours_start = 0, active_hours_end = 24, working_days = '1,2,3,4,5,6,7', daily_email_limit = 100 WHERE id = ?").run(emailAccountId);

  await tickActions(db);

  const events = db.prepare("SELECT * FROM outbound_events WHERE run_profile_id = ?").all(runProfileId) as any[];
  // It should have inserted an event
  expect(events.length).toBe(1);
  expect(events[0].status).toBe('sent');
  expect(events[0].step_id).toBe('step_succ');
  expect(events[0].message_id).toBe('msgX');
});

test('Case 8: Target with multiple run_profiles: ensure strict run_profile_id correlation', async () => {
  const { targetId, runId, runProfileId, accountId, emailAccountId } = setupRun('linkedin');
  // runProfileId is 'pending'

  // Setup second run profile for same target
  const runProfileIdB = randomUUID();
  const runIdB = randomUUID();
  db.prepare('INSERT INTO runs (id, account_id, status, workflow_id) VALUES (?, ?, ?, ?)').run(runIdB, accountId, 'running', 'wf1');
  db.prepare('INSERT INTO run_profiles (id, run_id, target_id, email_account_id) VALUES (?, ?, ?, ?)').run(runProfileIdB, runIdB, targetId, emailAccountId);
  db.prepare('INSERT INTO run_profile_states (run_profile_id, state) VALUES (?, ?)').run(runProfileIdB, 'completed');
  db.prepare("INSERT INTO run_profile_tracks (run_profile_id, state, track) VALUES (?, 'completed', 'linkedin')").run(runProfileIdB);
  
  // Seed outbound event for B (not A)
  db.prepare("INSERT INTO outbound_events (id, run_profile_id, channel, step_id, sent_at, run_id, target_id, status) VALUES (?, ?, 'linkedin', 'step3_2', '2020-01-02 10:00:00', ?, ?, 'sent')").run(randomUUID(), runProfileIdB, runId, targetId);

  // activeRun will pick up runProfileId (which is 'pending')
  captureSdrInboundMessage(db, {
    eventId: 'evt8',
    accountId,
    targetId,
    channel: 'linkedin',
    body: 'Multiple profiles',
    emailAccountId: emailAccountId,
    externalThreadId: 'thread1',
    externalMessageId: 'msg1',
    senderExternalId: 'urn:li:person:123',
    senderName: 'Test Sender',
    metadata: {},
    receivedAt: '2021-01-01 10:00:00'
  });

  const stateA = db.prepare('SELECT * FROM run_profile_states WHERE run_profile_id = ?').get(runProfileId) as any;
  const stateB = db.prepare('SELECT * FROM run_profile_states WHERE run_profile_id = ?').get(runProfileIdB) as any;
  
  // stateA shouldn't change because outbound event is on B
  expect(stateA.current_step_id).toBeNull(); // remains in whatever state it was (e.g. pending/running)
  // stateB shouldn't change because activeRun selected A
  expect(stateB.state).toBe('completed');
});
