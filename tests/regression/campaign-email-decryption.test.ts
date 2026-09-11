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

const target = {
  id: 'target-123',
  email: 'test@example.com',
  full_name: 'Test Target'
};

const baseStep = {
  id: 'step-123',
  step_type: 'email',
  email_body: 'Hello',
  email_subject: 'Subject',
  ai_enabled: 0,
  email_signature: null
};

const baseEmailAccountLimits = {
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

beforeEach(() => {
  vi.clearAllMocks();
});

test('executeStep with email decrypts email account password before sending', async () => {
  const result = await executeStep(
    mockDb,
    'run-123',
    'run-profile-123',
    'state-123',
    target as any,
    baseStep,
    'linkedin-acc-123',
    {} as any, // accountLimits
    'email-acc-123',
    baseEmailAccountLimits as any
  );

  expect(result.status).toBe('SUCCESS');
  
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const emailCredsArg = vi.mocked(sendEmail).mock.calls[0][0];
  
  expect(emailCredsArg.password).not.toBe('v1:encrypted_stuff');
  expect(emailCredsArg.password).toBe('decrypted_password123');
  
  const textArg = vi.mocked(sendEmail).mock.calls[0][3];
  expect(textArg).toBe('Hello');
});

test('executeStep appends account signature if present', async () => {
  await executeStep(
    mockDb, 'run-123', 'run-profile-123', 'state-123', target as any,
    baseStep,
    'linkedin-acc-123', {} as any, 'email-acc-123',
    { ...baseEmailAccountLimits, signature: 'Account Signature' } as any
  );
  
  const textArg = vi.mocked(sendEmail).mock.calls[0][3];
  expect(textArg).toBe('Hello\n\n--\nAccount Signature');
});

test('executeStep prioritizes step signature over account signature', async () => {
  await executeStep(
    mockDb, 'run-123', 'run-profile-123', 'state-123', target as any,
    { ...baseStep, email_signature: 'Step Signature' },
    'linkedin-acc-123', {} as any, 'email-acc-123',
    { ...baseEmailAccountLimits, signature: 'Account Signature' } as any
  );
  
  const textArg = vi.mocked(sendEmail).mock.calls[0][3];
  expect(textArg).toBe('Hello\n\n--\nStep Signature');
});

test('executeStep allows empty step signature to override account signature', async () => {
  await executeStep(
    mockDb, 'run-123', 'run-profile-123', 'state-123', target as any,
    { ...baseStep, email_signature: '' },
    'linkedin-acc-123', {} as any, 'email-acc-123',
    { ...baseEmailAccountLimits, signature: 'Account Signature' } as any
  );
  
  const textArg = vi.mocked(sendEmail).mock.calls[0][3];
  // Trim of empty string is empty string, which is falsy, so no signature appended
  expect(textArg).toBe('Hello');
});
