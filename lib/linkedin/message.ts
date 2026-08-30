import type { Page } from "playwright";
import { visitProfile } from "./visit";

export class NotConnectedError extends Error {}

export interface SendMessageResult {
  messagingUrn: string | null;
  isFirstDegree: boolean;
}

/**
 * Sends a message to a LinkedIn 1st-degree connection using the Voyager API.
 * Eliminates fragile DOM typing and language-specific button matching.
 */
export async function sendMessage(
  page: Page,
  fullName: string,
  text: string,
  linkedinUrl: string,
  messagingUrn?: string | null
): Promise<SendMessageResult> {
  // If we don't have the URN cached, we must resolve it.
  // We use visitProfile as it securely resolves the URN and checks 1st-degree status.
  let resolvedUrn = messagingUrn;
  let isFirstDegree = true;

  if (!resolvedUrn) {
    const resolved = await visitProfile(page, linkedinUrl);
    console.log(`[message] visitProfile resolved for ${fullName}:`, resolved);
    
    if (!resolved.isFirstDegree) {
      throw new NotConnectedError(`${fullName} is not a 1st-degree connection — refusing to message`);
    }

    if (!resolved.messagingUrn) {
      throw new Error(`Failed to resolve messaging URN for ${fullName} via profile visit. Refusing to guess via name search.`);
    }

    resolvedUrn = resolved.messagingUrn;
    isFirstDegree = resolved.isFirstDegree;
  }

  // Ensure we are on a valid linkedin.com page so fetch() inherits the origin and cookies
  if (!page.url().includes("linkedin.com")) {
     await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
  }

  const payload = {
    keyVersion: 'LEGACY_INBOX',
    conversationCreate: {
      eventCreate: {
        value: {
          'com.linkedin.voyager.messaging.create.MessageCreate': {
            attributedBody: {
              text: text,
              attributes: [],
            },
            attachments: [],
          },
        },
      },
      subtype: 'MEMBER_TO_MEMBER',
      recipients: [resolvedUrn],
    },
  };

  const result = await page.evaluate(async (payload) => {
    // Extract CSRF token inside the browser context
    const cookies = document.cookie.split("; ").reduce((a: Record<string, string>, c) => {
      const i = c.indexOf("=");
      if (i > 0) a[c.slice(0, i)] = c.slice(i + 1);
      return a;
    }, {});
    const csrf = (cookies["JSESSIONID"] || "").replace(/"/g, "");

    try {
      const res = await fetch("https://www.linkedin.com/voyager/api/messaging/conversations?action=create", {
        method: "POST",
        headers: {
          "csrf-token": csrf,
          "accept": "application/vnd.linkedin.normalized+json+2.1",
          "x-restli-protocol-version": "2.0.0",
          "x-li-lang": "en_US",
          "content-type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(payload)
      });
      
      const bodyText = await res.text();
      return { status: res.status, ok: res.ok, body: bodyText };
    } catch (e) {
      return { status: 0, ok: false, body: e instanceof Error ? e.message : String(e) };
    }
  }, payload);

  if (!result.ok) {
    throw new Error(`Voyager API messaging failed with HTTP ${result.status}: ${result.body}`);
  }

  console.log(`[message] Successfully sent message via API to ${resolvedUrn}. HTTP ${result.status}`);

  return { messagingUrn: resolvedUrn, isFirstDegree };
}
