import { Page } from "playwright";
import fs from "fs/promises";
import path from "path";

export interface ForensicContext {
  actionName: string;
  targetId?: string | null;
  expectedAction?: string;
  selectors?: string[];
  accountId: string;
}

export async function captureForensicFixture(
  page: Page,
  error: any,
  context: ForensicContext
): Promise<void> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const safeAction = context.actionName.replace(/[^a-zA-Z0-9]/g, "_");
    const dir = path.join(process.cwd(), ".ai", "evidence", "linkedin", `${timestamp}-${safeAction}`);
    
    await fs.mkdir(dir, { recursive: true });

    // 1. Screenshot
    await page.screenshot({ path: path.join(dir, "screenshot.png"), fullPage: true }).catch(() => {});

    // 2. URL & Title
    const url = page.url();
    const title = await page.title().catch(() => "");

    // 4. DOM Snapshot
    const html = await page.content().catch(() => "");
    await fs.writeFile(path.join(dir, "dom.html"), html);

    // 5. Accessibility Snapshot / Interactive Elements
    const interactive = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button, a, [role="button"], [role="menuitem"], .artdeco-dropdown__item'));
      return els.filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.getBoundingClientRect().height > 0;
      }).map(el => ({
        tag: el.tagName,
        text: (el as HTMLElement).innerText?.trim() || el.getAttribute("aria-label") || "",
        class: el.className,
        id: el.id
      }));
    }).catch(() => []);
    await fs.writeFile(path.join(dir, "interactive.json"), JSON.stringify(interactive, null, 2));

    // 6. Meta info
    const meta = {
      timestamp: new Date().toISOString(),
      url,
      title,
      action: context.actionName,
      targetId: context.targetId,
      expectedAction: context.expectedAction,
      selectors: context.selectors,
      accountId: context.accountId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    };
    await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2));

    console.log(`[forensics] Captured fixture for ${context.actionName} at ${dir}`);
  } catch (err) {
    console.error(`[forensics] Failed to capture fixture:`, err);
  }
}
