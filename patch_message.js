const fs = require('fs');
let content = fs.readFileSync('lib/linkedin/message.ts', 'utf8');

const newReplyToThread = `export async function replyToThread(page: import("playwright").Page, threadId: string, text: string, profileUrl?: string): Promise<void> {
  const cleanThreadId = threadId.includes(",") ? threadId.split(",")[1].replace(")", "") : threadId;
  const url = \`https://www.linkedin.com/messaging/thread/\${cleanThreadId}/\`;
  console.log("[replyToThread] Navigating to", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(5000);
  
  try {
    await sendFromComposeBox(page, text);
    return;
  } catch (err) {
    console.error("[replyToThread] Failed in thread view, attempting profile fallback...", err);
    if (!profileUrl) throw new Error("Thread view failed and no profile URL provided for fallback.");
  }
  
  // Fallback to profile overlay method
  console.log("[replyToThread] Navigating to profile:", profileUrl);
  await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(4000);
  
  const msgBtn = page.locator("button:has-text('Message'), button[aria-label*='Message']").first();
  await msgBtn.waitFor({ state: "visible", timeout: 10000 });
  await msgBtn.click();
  await page.waitForTimeout(2000);
  
  await sendFromComposeBox(page, text);
}`;

content = content.replace(/export async function replyToThread[\s\S]*?\}\n/, newReplyToThread + '\n');
fs.writeFileSync('lib/linkedin/message.ts', content);
