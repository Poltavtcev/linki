import type { Page } from "playwright";
import type { LinkedInInboxObservation, LinkedInInboxObservationSource, LinkedInInboxDirection } from "./inbox-sync";

export class LinkedInNetworkObserver implements LinkedInInboxObservationSource {
  async observe(page: Page): Promise<readonly LinkedInInboxObservation[]> {
    const observations: LinkedInInboxObservation[] = [];

    // Set up XHR interception before navigating
    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes("voyager/api/messaging/conversations") && response.status() === 200 && response.request().method() === "GET") {
        try {
          const json = await response.json();
          const elements = json?.elements || [];
          for (const conv of elements) {
            const threadId = conv.entityUrn?.replace("urn:li:fsd_conversation:", "") || "";
            if (!threadId) continue;
            
            // For now, we only look at the most recent message in the thread
            const events = conv.events || [];
            for (const event of events) {
              if (event.eventContent?.["*message"]) {
                // Determine direction
                const isFromUs = event.from?.["*miniProfile"]?.includes(json?.metadata?.viewerUrn);
                const direction: LinkedInInboxDirection = isFromUs ? "outbound" : "inbound";
                
                // Get the other participant
                const otherParticipant = conv.participants?.find((p: any) => p["*memberMiniProfile"] !== json?.metadata?.viewerUrn);
                const senderUrn = otherParticipant?.["*memberMiniProfile"] || "";
                
                // For name, we might need to look it up in included array if it's there, 
                // but basic XHR interception is fine.
                // In a robust implementation, we would map the URN to the included array entity.
                
                observations.push({
                  providerEventId: event.entityUrn,
                  externalThreadId: threadId,
                  externalMessageId: event.entityUrn || Math.random().toString(),
                  direction,
                  senderExternalId: senderUrn,
                  senderName: "LinkedIn Member", // simplified for now
                  body: event.eventContent["*message"]?.text || "",
                  receivedAt: new Date(event.createdAt || Date.now()).toISOString()
                });
              }
            }
          }
        } catch (err) {
          // Ignore parsing errors for individual responses
        }
      }
    });

    // Navigate to messaging to trigger the API calls
    await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
    
    // Wait a bit for the XHR calls to finish
    await page.waitForTimeout(5000);

    return observations;
  }
}
