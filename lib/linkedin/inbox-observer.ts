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
                  senderMessagingUrn: senderUrn,
                  senderExternalId: senderUrn,
                  senderProfileUrl: undefined,
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
      if (url.includes("graphql") && response.status() === 200) {
        try {
          const json = await response.json();
          const graphqlElements = json?.data?.messengerConversationsBySyncToken?.elements || json?.data?.messengerConversationsBySyncState?.elements || [];
          if (graphqlElements.length > 0) {
            console.log(`[observer] Found ${graphqlElements.length} conversations in GraphQL response`);
          }
          
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
                const participant = conv.conversationParticipants?.find((p: any) => p.participantType?.member?.profileUrl?.includes(senderUrn.split(":").pop()) || p.hostIdentityUrn === senderUrn);
                const member = participant?.participantType?.member;
                const senderProfileUrl = member?.profileUrl || "";
                let senderFullName = "LinkedIn Member";
                if (member?.firstName?.text) {
                  senderFullName = member.firstName.text + (member.lastName?.text ? " " + member.lastName.text : "");
                }
                
                // If it's inbound, it means the sender is NOT us.
                // We'll assume inbound if senderUrn does NOT match the hardcoded viewer ACoAACJo9dsBHVQROact7RLnQ91Hhnix6G4Wz64
                // Dynamically find the viewer URN from the conversation participants (distance: "SELF")
                const viewerParticipant = conv.conversationParticipants?.find((p: any) => p.participantType?.member?.distance === "SELF");
                const viewerUrn = viewerParticipant?.hostIdentityUrn || json?.metadata?.viewerUrn || "ACoAACJo9dsBHVQROact7RLnQ91Hhnix6G4Wz64";
                const isFromUs = senderUrn.includes(viewerUrn.replace("urn:li:fsd_profile:", ""));
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
                  senderName: senderFullName,
                  senderMessagingUrn: senderUrn, 
                  senderProfileUrl,
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
    
    // TEMPORARY DIAGNOSTIC DUMP
    
    const dumpHandler = async (response: any) => {
      const url = response.url();
      
    };
    page.on("response", dumpHandler);


    try {
      console.log(`[observer] Navigating to messaging...`);
      await page.goto("https://www.linkedin.com/messaging/", { waitUntil: "domcontentloaded" });
    
    
    // Wait for GraphQL to complete
    await page.waitForTimeout(5000);

    // EMERGENCY FALLBACK: Scan HTML <code> tags for embedded JSON state
    try {
      const embeddedState = await page.evaluate(() => {
        const codes = Array.from(document.querySelectorAll('code'));
        const states = [];
        for (const c of codes) {
          try {
            const txt = c.textContent?.trim() || "";
            if (txt.includes("messengerConversationsBySyncToken") || txt.includes("messengerConversationsBySyncState") || txt.includes("urn:li:fsd_conversation:")) {
              states.push(JSON.parse(txt));
            }
          } catch(e) {}
        }
        return states;
      });
      
      console.log(`[observer] Found ${embeddedState.length} embedded state blocks in HTML`);
      for (const json of embeddedState) {
          const graphqlElements = json?.data?.messengerConversationsBySyncToken?.elements || json?.data?.messengerConversationsBySyncState?.elements || json?.included || [];
          
          for (const conv of graphqlElements) {
            const threadUrn = conv.entityUrn || "";
            const threadId = threadUrn.replace("urn:li:msg_conversation:", "").replace("urn:li:fsd_conversation:", "");
            if (!threadId) continue;
            
            let messages = conv.messages?.elements || [];
            if (!messages.length && conv.events) {
               messages = conv.events.map((e: any) => ({
                 body: { text: e.eventContent?.["*message"] || e.eventContent?.message?.text || "" },
                 sender: { hostIdentityUrn: e.from?.["*miniProfile"] || e.from || "" },
                 createdAt: e.createdAt,
                 entityUrn: e.entityUrn
               }));
            }
            
            for (const msg of messages) {
              const text = msg.body?.text || msg.body;
              if (text && typeof text === "string") {
                const senderUrn = msg.sender?.hostIdentityUrn || msg.sender || "";
                const senderProfileUrl = conv.conversationParticipants?.find((p: any) => {
                  const url = p.participantType?.member?.profileUrl || p.member || "";
                  return url.includes(senderUrn.split(":").pop());
                })?.participantType?.member?.profileUrl || conv.conversationParticipants?.find((p: any) => {
                  const m = p.member || "";
                  return m.includes(senderUrn.split(":").pop());
                })?.member || "";
                
                observations.push({
                  externalThreadId: threadId,
                  externalMessageId: msg.entityUrn || Math.random().toString(),
                  direction: "inbound", // Assume inbound, inbox-sync will fix it
                  senderMessagingUrn: senderUrn,
                  senderExternalId: senderUrn,
                  senderProfileUrl: senderProfileUrl || undefined,
                  senderName: "LinkedIn Member",
                  body: text,
                  receivedAt: new Date(msg.createdAt || Date.now()).toISOString()
                });
              }
            }
          }
      }
    } catch (e) {
      console.error("[observer] Failed to parse embedded HTML state", e);
    }


      // console.log(`[observer] Captured ${observations.length} observations from network.`);
      
      
      return observations;
    } finally {
      page.off("response", responseHandler);
    }
  }
}
