import type { Page } from "playwright";
import { visitProfile } from "./visit";

export class NotConnectedError extends Error {}

export interface SendMessageResult {
  messagingUrn: string | null;
  isFirstDegree: boolean;
}

/**
 * Sends a message to a LinkedIn 1st-degree connection.
 *
 * Self-contained URN resolution — does NOT depend on a prior 'visit' workflow
 * step. If messagingUrn is already cached, it's used directly (no extra page
 * load). Otherwise this does its own live profile check (the same top-card-
 * scoped logic as the 'visit' step, see visit.ts) to fetch a fresh URN and
 * verify the target is still actually connected, immediately before sending.
 * Only if that live check finds no URN despite confirming 1st-degree does it
 * fall back to the connections-only name-search typeahead — a rare last
 * resort now, not the default path for every contact that lacks a cached URN.
 *
 * Throws NotConnectedError if the live check finds the target is NOT 1st-
 * degree, instead of guessing via typeahead search (which can silently hit
 * an unrelated connection with a similar/truncated name — see CLAUDE.md /
 * memory for the Jul 2026 incident this replaced).
 *
 * Returns the resolved { messagingUrn, isFirstDegree } so the caller can
 * persist it to the target record, same as the 'visit' step does.
 */
export async function sendMessage(
  page: Page,
  fullName: string,
  text: string,
  linkedinUrl: string,
  messagingUrn?: string | null
): Promise<SendMessageResult> {
  if (messagingUrn) {
    const opened = await openComposeByUrn(page, messagingUrn);
    if (opened) {
      await sendFromComposeBox(page, text);
      return { messagingUrn, isFirstDegree: true };
    }
  }

  const resolved = await visitProfile(page, linkedinUrl);
  console.log(`[message] visitProfile resolved for ${fullName}:`, resolved);
  
  if (!resolved.isFirstDegree) {
    throw new NotConnectedError(`${fullName} is not a 1st-degree connection — refusing to message`);
  }

  if (!resolved.messagingUrn) {
    throw new Error(`Failed to resolve messaging URN for ${fullName} via profile visit. Refusing to guess via name search.`);
  }

  const opened = await openComposeByUrn(page, resolved.messagingUrn);
  if (!opened) {
    throw new Error(`Failed to open compose box for URN ${resolved.messagingUrn}`);
  }

  await sendFromComposeBox(page, text);
  return resolved;
}

async function openComposeByUrn(page: Page, messagingUrn: string): Promise<boolean> {
  try {
    if (page.url().includes('/in/')) {
      const mainArea = page.locator("main").first();
      
      // Step 1: Check if Message button is directly visible
      let msgBtn = mainArea.locator('button.message-anywhere-button, a[href*="/messaging/compose"], button[aria-label^="Message"], button[aria-label^="Повідомлення"], button:has-text("Message"), button:has-text("Повідомлення"), a:has-text("Message"), a:has-text("Повідомлення")').filter({ hasNot: page.locator('span:has-text("More")') }).first();
      
      if (await msgBtn.count() === 0 || !(await msgBtn.isVisible())) {
        console.log(`[message] Message button not immediately visible in main. Trying 'More' dropdown.`);
        const moreBtn = mainArea.locator('button[aria-label^="More"], button[aria-label^="Більше"], button.artdeco-dropdown__trigger').filter({ hasText: /More|Більше|\.\.\./i }).first();
        if (await moreBtn.count() > 0 && await moreBtn.isVisible()) {
          await moreBtn.click();
          await page.waitForTimeout(1000);
          msgBtn = mainArea.locator('div.artdeco-dropdown__content button:has-text("Message"), div.artdeco-dropdown__content button:has-text("Повідомлення"), div.artdeco-dropdown__content a:has-text("Message"), div.artdeco-dropdown__content a:has-text("Повідомлення")').first();
        }
      }
      
      if (await msgBtn.count() > 0) {
        console.log(`[message] Clicking profile Message button...`);
        await msgBtn.click({ force: true });
        
        const msgInput = page.locator("div.msg-form__contenteditable").first();
        try {
          await msgInput.waitFor({ timeout: 10000 });
          return true;
        } catch (timeoutErr) {
          console.log(`[message] Timeout waiting for compose box to appear after clicking Message button.`);
          throw timeoutErr;
        }
      }
    }
    
    console.log(`[message] Message button completely missing from UI.`);
    return false;
  } catch (e) {
    console.error(`[message] Failed to open compose for ${messagingUrn}:`, e);
    return false;
  }
}

async function sendFromComposeBox(page: Page, text: string): Promise<void> {
  // Paste message into compose area
  const msgInput = page.locator("div.msg-form__contenteditable").first();
  await msgInput.waitFor({ timeout: 8000 });
  await msgInput.click();
  // Type text directly (simulates real keystrokes, triggering React onChange events)
  await msgInput.pressSequentially(text, { delay: 10 });
  await page.waitForTimeout(500);

  // Send
  const sendBtn = page.locator("button.msg-form__send-button:visible").first();
  await sendBtn.waitFor({ timeout: 5000 });
  await sendBtn.click({ delay: 100 });
  await page.waitForTimeout(2000);
}
