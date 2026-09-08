import { Page } from "playwright";
import { getDb } from "../../lib/db";
export class NotConnectedError extends Error {}
import { visitProfile } from "./visit";

export type SendMessageResult = {
  messagingUrn: string | null;
  isFirstDegree: boolean;
};

function getTargetIdentifier(messagingUrn?: string | null, linkedinUrl?: string): string {
  if (messagingUrn) {
    const match = messagingUrn.match(/ACo[A-Za-z0-9_-]+/);
    if (match) return match[0];
  }
  if (linkedinUrl) {
    const match = linkedinUrl.match(/\/in\/([^\/?]+)/);
    if (match) return match[1];
  }
  throw new Error("UNKNOWN: Could not extract target identifier from URN or URL");
}

async function getConversationContainer(page: Page, urnId: string | null, vanityId: string | null) {
  if (!urnId && !vanityId) throw new Error("UNKNOWN: Could not extract target identifier");

  const containers = page.locator('.msg-overlay-conversation-bubble, .msg-thread');
  const count = await containers.count();
  if (count === 0) throw new Error(`FAIL CLOSED: Target conversation absent`);
  
  let activeContainer = null;
  for (let i = 0; i < count; i++) {
    const container = containers.nth(i);
    const matches = await container.evaluate((el: Element, { urnId, vanityId }: { urnId: string | null, vanityId: string | null }) => {
       const links = el.querySelectorAll('header a[href*="/in/"], .msg-thread__topcard a[href*="/in/"]');
       for (const link of Array.from(links)) {
         const href = link.getAttribute('href') || "";
         const urlObj = new URL(href, 'https://www.linkedin.com');
         const pathParts = urlObj.pathname.split('/').filter(Boolean);
         if (pathParts[0] === 'in' && pathParts[1]) {
           const id = pathParts[1];
           if (urnId && id === urnId) return true;
           if (vanityId && id === vanityId) return true;
         }
       }
       return false;
    }, { urnId, vanityId });
    
    if (matches && await container.isVisible()) {
      activeContainer = container;
      break;
    }
  }
  
  if (!activeContainer) throw new Error(`FAIL CLOSED: Target conversation container found but not visible`);

  // PRE-SEND ASSERTION: Confirm one last time right before returning
  const isConfirmed = await activeContainer.evaluate((el: Element, { urnId, vanityId }: { urnId: string | null, vanityId: string | null }) => {
       const links = el.querySelectorAll('header a[href*="/in/"], .msg-thread__topcard a[href*="/in/"]');
       for (const link of Array.from(links)) {
         const href = link.getAttribute('href') || "";
         const urlObj = new URL(href, 'https://www.linkedin.com');
         const pathParts = urlObj.pathname.split('/').filter(Boolean);
         if (pathParts[0] === 'in' && pathParts[1]) {
           const id = pathParts[1];
           if (urnId && id === urnId) return true;
           if (vanityId && id === vanityId) return true;
         }
       }
       return false;
  }, { urnId, vanityId });
  
  if (!isConfirmed) throw new Error("FAIL CLOSED: Pre-send assertion failed. Conversation identity mismatch.");

  return activeContainer;
}

async function openComposeByIdentifier(page: Page, urnId: string | null, vanityId: string | null): Promise<boolean> {
  try {
    try {
      await getConversationContainer(page, urnId, vanityId);
      return true;
    } catch (e) {
      // not open yet
    }

    if (page.url().includes('/in/')) {
      const mainArea = page.locator("main").first();
      
      let msgBtn = mainArea.locator('button.message-anywhere-button, a[href*="/messaging/compose"], button[aria-label^="Message"], button[aria-label^="Повідомлення"], button[aria-label^="Mensaje"], button[aria-label^="Mensagem"], button:has-text("Message"), button:has-text("Повідомлення"), button:has-text("Mensaje"), button:has-text("Mensagem"), a:has-text("Message"), a:has-text("Повідомлення"), a:has-text("Mensaje"), a:has-text("Mensagem")').filter({ hasNot: page.locator('span:has-text("More")') }).first();
      
      if (await msgBtn.count() === 0 || !(await msgBtn.isVisible())) {
        console.log(`[message] Message button not immediately visible in main. Trying 'More' dropdown.`);
        const moreBtn = mainArea.locator('button[aria-label^="More"], button[aria-label^="Більше"], button.artdeco-dropdown__trigger').filter({ hasText: /More|Більше|\.\.\./i }).first();
        if (await moreBtn.count() > 0 && await moreBtn.isVisible()) {
          await moreBtn.click();
          await mainArea.locator('div.artdeco-dropdown__content, div[role="menu"]').first().waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
          msgBtn = mainArea.locator('div.artdeco-dropdown__content button:has-text("Message"), div.artdeco-dropdown__content button:has-text("Повідомлення"), div.artdeco-dropdown__content a:has-text("Message"), div.artdeco-dropdown__content a:has-text("Повідомлення")').first();
        }
      }
      
      if (await msgBtn.count() > 0) {
        console.log(`[message] Clicking profile Message button...`);
        await msgBtn.click({ force: true });
        
        const container = await getConversationContainer(page, urnId, vanityId);
        
        try {
          await container.waitFor({ state: 'visible', timeout: 10000 });
          return true;
        } catch (timeoutErr) {
          console.log(`[message] Timeout waiting for specific target compose box to appear after clicking Message button.`);
          throw timeoutErr;
        }
      }
    }
    
    console.log(`[message] Message button completely missing from UI.`);
    return false;
  } catch (e) {
    console.error(`[message] Failed to open compose for:`, e);
    return false;
  }
}

async function sendFromComposeBox(page: Page, urnId: string | null, vanityId: string | null, text: string): Promise<void> {
  const container = await getConversationContainer(page, urnId, vanityId);

  const msgInput = container.locator("div.msg-form__contenteditable, div[role='textbox'][aria-label*='Message'], div[role='textbox'][aria-label*='Mensaje'], div[role='textbox'][aria-label*='Mensagem'], div[role='textbox'][aria-label*='Повідомлення']").first();
  await msgInput.waitFor({ timeout: 8000 });
  await msgInput.click();
  for (const char of text) {
    await msgInput.pressSequentially(char, { delay: 15 + Math.random() * 40 });
    await page.waitForTimeout(30 + Math.random() * 50);
  }
  await page.waitForTimeout(500);

  const sendBtn = container.locator("button.msg-form__send-button:visible, button[type='submit'].msg-form__send-button:visible, button.msg-form__send-btn:visible").first();
  await sendBtn.waitFor({ timeout: 5000 });
  await sendBtn.click({ delay: 100 });
  
  const start = Date.now();
  let inputCleared = false;
  let bubbleAppeared = false;
  
  while (Date.now() - start < 5000) {
    try {
      const isVisible = await msgInput.isVisible();
      if (isVisible) {
        const currentText = await msgInput.innerText();
        if (currentText.trim() === "") inputCleared = true;
      }
    } catch (e) {
      // Detached or error
    }
    
    bubbleAppeared = await container.evaluate((root: Element, expectedText: string) => {
      const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
      const target = normalize(expectedText);
      const targetPrefix = target.length > 100 ? target.substring(0, 100) : target;
      
      const getBubbles = (node: Element | Document | ShadowRoot): Element[] => {
        let results: Element[] = [];
        const elements = node.querySelectorAll('p, span, div.msg-s-event-listitem__body, div.msg-s-message-group__meta');
        for (const el of Array.from(elements)) {
            if (el.closest('[contenteditable="true"], [role="textbox"]')) continue;
            results.push(el);
        }
        const allNodes = node.querySelectorAll('*');
        for (const n of Array.from(allNodes)) {
          if (n.shadowRoot) {
            results.push(...getBubbles(n.shadowRoot));
          }
        }
        return results;
      };
      
      const bubbles = getBubbles((root as any).shadowRoot || root);
      for (const b of bubbles) {
        const elText = normalize(b.textContent || "");
        if (elText && elText.includes(targetPrefix)) {
          if (elText.length <= target.length + 150) return true;
        }
      }
      return false;
    }, text).catch(() => false);

    const toastAppeared = await page.evaluate(() => {
      const toasts = document.querySelectorAll('.artdeco-toast-item:not(.artdeco-toast-item--error)');
      for (const toast of Array.from(toasts)) {
        if (window.getComputedStyle(toast).display === 'none') continue;
        const txt = (toast.textContent || "").toLowerCase();
        if (txt.includes('sent') || txt.includes('enviad') || txt.includes('wysłan') || txt.includes('відправлен')) {
          return true;
        }
      }
      return false;
    }).catch(() => false);

    if (inputCleared && (bubbleAppeared || toastAppeared)) {
      break;
    }
    await page.waitForTimeout(500);
  }
  
  if (!(inputCleared && bubbleAppeared)) {
    const errorBanner = container.locator(".artdeco-inline-feedback--error, .msg-form__error-message, .artdeco-toast-item--error, .ph1.artdeco-inline-feedback").first();
    let errorText = "Silent failure";
    if (await errorBanner.isVisible().catch(() => false)) {
      errorText = await errorBanner.innerText().catch(() => errorText);
    }
    throw new Error(`Message send failed. inputCleared=${inputCleared}, bubbleAppeared=${bubbleAppeared}. Rejection reason: ${errorText}`);
  }
}

export async function sendMessage(
  page: Page,
  fullName: string,
  text: string,
  linkedinUrl: string,
  messagingUrn?: string | null
): Promise<SendMessageResult> {
  let urnId = null;
  const urnMatch = messagingUrn?.match(/ACo[A-Za-z0-9_-]+/);
  if (urnMatch) urnId = urnMatch[0];
  let vanityId = null;
  if (linkedinUrl) {
    const urlMatch = linkedinUrl.match(/\/in\/([^\/?]+)/);
    if (urlMatch) vanityId = urlMatch[1];
  }

  if (messagingUrn) {
    const opened = await openComposeByIdentifier(page, urnId, vanityId);
    if (opened) {
      await sendFromComposeBox(page, urnId, vanityId, text);
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

  let newUrnId = null;
  const newUrnMatch = resolved.messagingUrn?.match(/ACo[A-Za-z0-9_-]+/);
  if (newUrnMatch) newUrnId = newUrnMatch[0];

  const opened2 = await openComposeByIdentifier(page, newUrnId, vanityId);
  if (!opened2) {
    throw new Error(`Failed to open compose box for URN ${resolved.messagingUrn}`);
  }

  await sendFromComposeBox(page, newUrnId, vanityId, text);
  return resolved;
}

export async function replyToThread(page: Page, threadId: string, text: string, profileUrl?: string): Promise<void> {
  const cleanThreadId = threadId.includes(",") ? threadId.split(",")[1].replace(")", "") : threadId;
  const url = `https://www.linkedin.com/messaging/thread/${cleanThreadId}/`;
  console.log("[replyToThread] Navigating to", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(5000);
  
  let threadVanityId = null;
  if (profileUrl) {
    const urlMatch = profileUrl.match(/\/in\/([^\/?]+)/);
    if (urlMatch) threadVanityId = urlMatch[1];
  }

  try {
    await sendFromComposeBox(page, null, threadVanityId, text);
    return;
  } catch (err) {
    console.error("[replyToThread] Failed in thread view, attempting profile fallback...", err);
    if (!profileUrl) throw new Error("Thread view failed and no profile URL provided for fallback.");
  }
  
  console.log("[replyToThread] Navigating to profile:", profileUrl);
  await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4000);
  
  const opened3 = await openComposeByIdentifier(page, null, threadVanityId);
  if (!opened3) throw new Error(`Failed to open compose box for profile ${profileUrl}`);
  
  await sendFromComposeBox(page, null, threadVanityId, text);
}
