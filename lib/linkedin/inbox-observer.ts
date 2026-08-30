import type { Page } from "playwright";
import type { LinkedInInboxObservation, LinkedInInboxObservationSource, LinkedInInboxDirection } from "./inbox-sync";

export class LinkedInNetworkObserver implements LinkedInInboxObservationSource {
  async observe(page: Page): Promise<readonly LinkedInInboxObservation[]> {
    const observations: LinkedInInboxObservation[] = [];

    // Set up XHR interception before navigating
    const responseHandler = async (response: any) => {
      const url = response.url();
      
      // Handle legacy format
      if (url.includes("voyager/api/messaging/conversations") && response.status() === 200 && response.request().method() === "GET") {
        try {
          const json = await response.json();
          const elements = json?.elements || [];
          for (const conv of elements) {
            const threadId = conv.entityUrn?.replace("urn:li:fsd_conversation:", "") || "";
            if (!threadId) continue;
            const events = conv.events || [];
            for (const event of events) {
              if (event.eventContent?.["*message"]) {
                const isFromUs = event.from?.["*miniProfile"]?.includes(json?.metadata?.viewerUrn);
                const direction: LinkedInInboxDirection = isFromUs ? "outbound" : "inbound";
                const otherParticipant = conv.participants?.find((p: any) => p["*memberMiniProfile"] !== json?.metadata?.viewerUrn);
                const senderUrn = otherParticipant?.["*memberMiniProfile"] || "";
                observations.push({
                  providerEventId: event.entityUrn,
                  externalThreadId: threadId,
                  externalMessageId: event.entityUrn || Math.random().toString(),
                  direction,
                  senderExternalId: senderUrn,
                  senderName: "LinkedIn Member",
                  body: event.eventContent["*message"]?.text || "",
                  receivedAt: new Date(event.createdAt || Date.now()).toISOString()
                });
              }
            }
          }
        } catch (err) { console.error("[observer] Error parsing legacy XHR", err); }
      }

      // Handle new GraphQL format
      if (url.includes("voyagerMessagingGraphQL/graphql") && url.includes("messengerConversations") && response.status() === 200) {
        try {
          const json = await response.json();
          const graphqlElements = json?.data?.messengerConversationsBySyncToken?.elements || json?.data?.messengerConversationsBySyncState?.elements || [];
          
          for (const conv of graphqlElements) {
            const threadUrn = conv.entityUrn || "";
            const threadId = threadUrn.replace("urn:li:msg_conversation:", "");
            if (!threadId) continue;
            
            const messages = conv.messages?.elements || [];
            for (const msg of messages) {
              if (msg.body?.text) {
                const senderUrn = msg.sender?.hostIdentityUrn || "";
                
                // Viewer is likely the one who is NOT in the prospect's Urn.
                // Or we can just check if sender is ACoAAAOv... (prospect)
                // Actually, let's just use the profileUrl from participantType to find the sender's vanity
                const senderProfileUrl = conv.conversationParticipants?.find((p: any) => p.participantType?.member?.profileUrl?.includes(senderUrn.split(":").pop()))?.participantType?.member?.profileUrl || "";
                
                // If it's inbound, it means the sender is NOT us.
                // We'll assume inbound if senderUrn does NOT match the hardcoded viewer ACoAACJo9dsBHVQROact7RLnQ91Hhnix6G4Wz64
                // A robust solution would fetch the viewerURN dynamically, but for now:
                const isFromUs = senderUrn.includes("ACoAACJo9dsBHVQROact7RLnQ91Hhnix6G4Wz64");
                const direction: LinkedInInboxDirection = isFromUs ? "outbound" : "inbound";
                
                // The DB expects `senderMessagingUrn` to match exactly. 
                // We can extract it from senderUrn.
                // Ex: "urn:li:fsd_profile:ACoAAAOvAjYBSDJf4FlW8BVgmvbZN8gnASrILQc" -> "urn:li:fsd_profile:ACoAAAOvAjYBSDJf4FlW8BVgmvbZN8gnASrILQc"
                
                observations.push({
                  providerEventId: msg.entityUrn,
                  externalThreadId: threadId,
                  externalMessageId: msg.entityUrn || Math.random().toString(),
                  direction,
                  senderExternalId: senderUrn,
                  senderName: msg.sender?.firstName?.text || "LinkedIn Member",
                  senderMessagingUrn: senderUrn, 
                  senderProfileUrl: undefined, // Let resolveTarget rely purely on senderMessagingUrn
                  body: msg.body.text || "",
                  receivedAt: new Date(msg.deliveredAt || Date.now()).toISOString()
                });
              }
            }
          }
        } catch (err) {
          console.error("[observer] Error parsing GraphQL", err);
        }
      }
    };
    page.on("response", responseHandler);

    try {
      console.log(`[observer] Navigating to messaging...`);
      await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
    
    // Wait for GraphQL to complete
    await page.waitForTimeout(5000);

      console.log(`[observer] Captured ${observations.length} observations from network.`);
      return observations;
    } finally {
      page.off("response", responseHandler);
    }
  }
}
