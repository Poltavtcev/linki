import { captureForensicFixture } from "../../lib/linkedin/forensics";
import { Page } from "playwright";
import fs from "fs/promises";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// Mock fs to prevent actual file writes during tests
vi.mock("fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined)
  }
}));

describe("captureForensicFixture environment gate", () => {
  let mockPage: Partial<Page>;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    
    mockPage = {
      screenshot: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue("https://example.com"),
      title: vi.fn().mockResolvedValue("Test Title"),
      content: vi.fn().mockResolvedValue("<html></html>"),
      evaluate: vi.fn().mockResolvedValue([])
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const runCapture = async () => {
    await captureForensicFixture(mockPage as Page, new Error("Test Error"), {
      actionName: "test_action",
      accountId: "test_account"
    });
  };

  it("1. non-production -> capture is enabled", async () => {
    Object.defineProperty(process.env, "NODE_ENV", { value: "development" });
    process.env.FORENSICS_ENABLED = undefined;

    await runCapture();

    // Verify it reached fs.mkdir (meaning it bypassed the early return)
    expect(fs.mkdir).toHaveBeenCalled();
  });

  it("2. production + FORENSICS_ENABLED missing -> capture is disabled", async () => {
    Object.defineProperty(process.env, "NODE_ENV", { value: "production" });
    process.env.FORENSICS_ENABLED = undefined;

    await runCapture();

    // Verify it did not reach fs.mkdir
    expect(fs.mkdir).not.toHaveBeenCalled();
  });

  it("3. production + FORENSICS_ENABLED=true -> capture is enabled", async () => {
    Object.defineProperty(process.env, "NODE_ENV", { value: "production" });
    process.env.FORENSICS_ENABLED = "true";

    await runCapture();

    // Verify it reached fs.mkdir
    expect(fs.mkdir).toHaveBeenCalled();
  });
});
