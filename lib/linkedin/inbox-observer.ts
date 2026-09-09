import type { Page } from "playwright";
import type { LinkedInInboxObservation, LinkedInInboxObservationSource, LinkedInInboxDirection } from "./inbox-sync";

async function fetchCurrentUrns(page: Page): Promise<Set<string>> {
  return page.evaluate(async (): Promise<string[]> => {
    try {
      const cookies = document.cookie.split("; ").reduce((values: Record<string, string>, cookie) => {
        const index = cookie.indexOf("=");
        if (index > 0) values[cookie.slice(0, index).trim()] = cookie.slice(index + 1).trim();
        return values;
      }, {});
      const csrf = (cookies.JSESSIONID || cookies.jsessionid || "").replace(/\"/g, "");
      const headers: Record<string, string> = {
        accept: "application/vnd.linkedin.normalized+json+2.1",
        "x-restli-protocol-version": "2.0.0",
      };
      if (csrf) headers["csrf-token"] = csrf;
      const response = await fetch("https://www.linkedin.com/voyager/api/me", {
        method: "GET",
        headers,
        credentials: "include",
      });
      if (!response.ok) return [];
      const body = await response.json();
      
      const urns = new Set<string>();
      const visit = (value: unknown, depth: number): void => {
        if (depth > 5 || !value || typeof value !== "object") return;
        const record = value as Record<string, unknown>;
        for (const key of ["entityUrn", "objectUrn", "profileUrn", "dashEntityUrn", "*miniProfile"]) {
          const val = record[key];
          if (typeof val === "string" && val.toLowerCase().includes("profile")) {
            urns.add(val);
          }
        }
        for (const nested of Object.values(record)) {
          if (nested && typeof nested === "object") visit(nested, depth + 1);
        }
      };
      visit(body, 0);
      return Array.from(urns);
    } catch (err) {
      return [];
    }
  }).then(arr => new Set(arr)).catch(() => new Set());
}

export class LinkedInNetworkObserver implements LinkedInInboxObservationSource {
  async observe(page: Page): Promise<readonly LinkedInInboxObservation[]> {
    const observations: LinkedInInboxObservation[] = [];
    
    // Explicitly fetch the current authenticated session identity first.
    // We navigate to a neutral LinkedIn page to establish the origin before fetching.
    console.log("[observer] Establishing origin to fetch identity...");
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
    
    const currentUrns = await fetchCurrentUrns(page);
    
    if (currentUrns.size === 0) {
      throw new Error("AUTH_REQUIRED: Failed to determine current viewer identity");
    }
    
    console.log(`[observer] Determined current identity URNs: ${Array.from(currentUrns).join(", ")}`);

    const resolveDirection = (senderUrn: string): LinkedInInboxDirection | null => {
      if (!senderUrn) return null;
      // Compare ignoring prefix differences if any, but explicitly checking the ID part
      const senderId = senderUrn.split(":").pop();
      if (!senderId) return null;
      
      for (const urn of currentUrns) {
        if (urn.includes(senderId)) return "outbound";
      }
      return "inbound";
    };

    const responseHandler = async (response: any) => {
      const url = response.url();
      
      // Handle legacy XHR format
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
                const senderUrn = event.from?.["*miniProfile"] || "";
                const direction = resolveDirection(senderUrn);
                if (!direction) continue; // Fail closed if identity cannot be determined
                
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
          
          for (const conv of graphqlElements) {
            const threadUrn = conv.entityUrn || "";
            const threadId = threadUrn.replace("urn:li:msg_conversation:", "");
            if (!threadId) continue;
            
            const messages = conv.messages?.elements || [];
            for (const msg of messages) {
              if (msg.body?.text) {
                const senderUrn = msg.sender?.hostIdentityUrn || "";
                const direction = resolveDirection(senderUrn);
                if (!direction) continue; // Fail closed
                
                const participant = conv.conversationParticipants?.find((p: any) => p.participantType?.member?.profileUrl?.includes(senderUrn.split(":").pop()) || p.hostIdentityUrn === senderUrn);
                const member = participant?.participantType?.member;
                const senderProfileUrl = member?.profileUrl || "";
                let senderFullName = "LinkedIn Member";
                if (member?.firstName?.text) {
                  senderFullName = member.firstName.text + (member.lastName?.text ? " " + member.lastName.text : "");
                }
                
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
                  const direction = resolveDirection(senderUrn);
                  if (!direction) continue; // Fail closed
                  
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
                    direction, 
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

      return observations;
    } finally {
      page.off("response", responseHandler);
    }
  }
}
