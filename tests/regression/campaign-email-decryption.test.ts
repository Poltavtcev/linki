import { expect, test, vi, beforeEach } from 'vitest';
import { executeStep } from '@/lib/linkedin/runner';
import { sendEmail } from '@/lib/email/sender';
import { decryptSecret } from '@/lib/crypto';

vi.mock('@/lib/email/sender', () => ({
  sendEmail: vi.fn().mockResolvedValue('mock-msg-id'),
}));

vi.mock('@/lib/crypto', () => ({
  decryptSecret: vi.fn((val) => {
    if (val === 'v1:encrypted_stuff') return 'decrypted_password123';
    return val;
  }),
}));

const mockDb = {
  prepare: vi.fn(() => ({
    get: vi.fn().mockReturnValue(undefined),
    run: vi.fn().mockReturnValue({ changes: 1 }),
    all: vi.fn().mockReturnValue([]),
  })),
} as any;

test('executeStep with email decrypts email account password before sending', async () => {
  const target = {
    id: 'target-123',
    email: 'test@example.com',
    full_name: 'Test Target'
  };

  const step = {
    id: 'step-123',
    step_type: 'email',
    email_body: 'Hello',
    email_subject: 'Subject',
    ai_enabled: 0
  };

  const emailAccountLimits = {
    id: 'email-acc-123',
    username: 'sender@example.com',
    password: 'v1:encrypted_stuff',
    active_hours_start: 9,
    active_hours_end: 17,
    timezone: 'UTC',
    working_days: '1,2,3,4,5',
    daily_email_limit: 100,
    ramp_up_enabled: 0,
    ramp_start_date: null
  };

  const result = await executeStep(
    mockDb,
    'run-123',
    'run-profile-123',
    'state-123',
    target as any,
    step,
    'linkedin-acc-123',
    {} as any, // accountLimits
    'email-acc-123',
    emailAccountLimits as any
  );

  expect(result.status).toBe('SUCCESS');
  
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const emailCredsArg = vi.mocked(sendEmail).mock.calls[0][0];
  
  // The raw encrypted value should NOT be passed
  expect(emailCredsArg.password).not.toBe('v1:encrypted_stuff');
  // The decrypted value SHOULD be passed
  expect(emailCredsArg.password).toBe('decrypted_password123');
});
