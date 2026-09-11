import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ensureGlobalRunnerStarted } from '@/lib/linkedin/runner';

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(() => ({
    prepare: vi.fn(() => ({
      get: vi.fn(),
      run: vi.fn(),
      all: vi.fn(),
    })),
  })),
}));

describe('ensureGlobalRunnerStarted Lifecycle', () => {
  const g = global as typeof global & {
    __linkiGlobalRunnerStarted?: boolean;
    __linkiRunnerVersion?: number;
  };

  let originalEnv: string | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    // reset global state
    g.__linkiGlobalRunnerStarted = false;
    g.__linkiRunnerVersion = 0;
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    process.env.NODE_ENV = originalEnv;
  });

  it('Production Behavior (process.env.NODE_ENV = "production")', () => {
    process.env.NODE_ENV = 'production';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // First call
    ensureGlobalRunnerStarted();
    expect(g.__linkiRunnerVersion).toBe(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Global loop started. Version: 1'));

    consoleSpy.mockClear();

    // Second call
    ensureGlobalRunnerStarted();
    expect(g.__linkiRunnerVersion).toBe(1); // Should not increment in production if already started
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('Development Behavior (process.env.NODE_ENV = "development")', () => {
    process.env.NODE_ENV = 'development';
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // First call
    ensureGlobalRunnerStarted();
    expect(g.__linkiRunnerVersion).toBe(1);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Global loop started. Version: 1'));

    consoleSpy.mockClear();

    // Second call
    ensureGlobalRunnerStarted();
    expect(g.__linkiRunnerVersion).toBe(2);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Global loop started. Version: 2'));

    consoleSpy.mockClear();

    // Third call
    ensureGlobalRunnerStarted();
    expect(g.__linkiRunnerVersion).toBe(3);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Global loop started. Version: 3'));
  });
});
