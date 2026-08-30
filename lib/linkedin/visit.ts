import type { Page } from "playwright";

/**
 * Visits a LinkedIn profile page. This registers as a profile view on LinkedIn.
 * Reports whether the page shows a 1st-degree badge in all UI languages (PT, ES, EN).
 */
export async function visitProfile(
  page: Page,
  linkedinUrl: string
): Promise<{ isFirstDegree: boolean; messagingUrn: string | null }> {
  let messagingUrn: string | null = null;

  // Attempt to go directly to the profile URL
  await page.goto(linkedinUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(4000 + Math.random() * 2000); // Wait longer for XHRs to finish

  const topCard = page.locator("main section").filter({ has: page.locator("h1") }).first();
  const pageText = await topCard.innerText().catch(() => "");

  const isExplicit2ndOr3rd = /\b(?:2nd|3rd|2º|3º|2ª|3ª)\b/i.test(pageText) || /•\s*(?:2|3)º/i.test(pageText);
  const isExplicit1st = /\b(?:1st|1º|1ª)\b/i.test(pageText) || /•\s*1º/i.test(pageText);

  const mainArea = page.locator("main").first();
  const messageLink = mainArea.locator('a[href*="/messaging/compose"]').first();
  const messageHref = (await messageLink.count()) > 0 ? await messageLink.getAttribute("href").catch(() => null) : null;
  let urnMatch = messageHref?.match(/profileUrn=([^&]+)/);
  
  if (!messagingUrn && urnMatch) {
    messagingUrn = decodeURIComponent(urnMatch[1]);
  }

  if (!messagingUrn) {
    const html = await page.content();
    const htmlMatch = html.match(/profileUrn=(urn(?:%3A|:)li(?:%3A|:)fsd_profile(?:%3A|:)[^&"]+)/);
    if (htmlMatch) {
      messagingUrn = decodeURIComponent(htmlMatch[1]);
    }
  }
  
  if (!messagingUrn) {
    console.log(`[visit] Network, Message Button, and DOM Regex all failed to extract URN.`);
  }

  if (isExplicit1st) {
    return { isFirstDegree: true, messagingUrn };
  }

  if (messageHref && !isExplicit2ndOr3rd) {
    return { isFirstDegree: true, messagingUrn };
  }

  const hasMessageButton = await mainArea.locator('button:has-text("Message"), button:has-text("Повідомлення")').count() > 0;
  if (hasMessageButton && !isExplicit2ndOr3rd) {
    return { isFirstDegree: true, messagingUrn };
  }

  if (isExplicit2ndOr3rd) {
    return { isFirstDegree: false, messagingUrn: null };
  }

  // Ambiguous: LinkedIn UI might be slow or changed. 
  // Return true so message.ts falls back to Typeahead search, 
  // which has its own strict validation (will throw generic Error, not NotConnectedError).
  return { isFirstDegree: true, messagingUrn };
}
