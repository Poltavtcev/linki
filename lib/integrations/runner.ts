import { getDb } from "@/lib/db";
import { log } from "@/lib/linkedin/runner";
import { decryptSecret } from "@/lib/crypto";
import { matchPerson } from "@/lib/apollo";

export async function executeIntegrationStep(
  db: ReturnType<typeof getDb>,
  runId: string,
  tr: any,
  target: any,
  step: any,
  steps: any[]
): Promise<void> {
  if (!step.config) {
    log(db, runId, target.id, "warn", `Integration step missing config`);
    return;
    return;
  }

  let config = { action_type: "enrich_email", provider_chain: ["prospeo", "apollo", "snov", "skrapp", "hunter", "lusha", "contactout"] as string[] };
  try {
    if (step.config && step.config !== "null") {
      const parsed = JSON.parse(step.config);
      if (parsed && typeof parsed === "object") {
        config = parsed;
      }
    }
  } catch (e) {
    log(db, runId, target.id, "error", `Failed to parse integration config: ${(e as Error).message}`);
    return;
    return;
  }

  if (config.action_type === "enrich_email") {
    const fresh = db.prepare("SELECT email FROM targets WHERE id = ?").get(target.id) as { email: string | null } | undefined;
    if (fresh?.email) {
      log(db, runId, target.id, "info", `Contact already has an email (${fresh.email}) — skipping enrichment waterfall`);
      return;
      return;
    }

    const fullChain = (config.provider_chain && config.provider_chain.length > 0) ? config.provider_chain : ["prospeo", "apollo", "snov", "skrapp", "hunter", "lusha", "contactout"];
    const activeProviders = db.prepare("SELECT key FROM integrations WHERE is_active = 1 AND api_key IS NOT NULL AND api_key != ''").all() as { key: string }[];
    const activeKeys = new Set(activeProviders.map(p => p.key));
    const chain = fullChain.filter(p => activeKeys.has(p));
    
    if (chain.length === 0) {
      log(db, runId, target.id, "warn", `Skipping enrichment - no active providers configured.`);
      return;
      return;
    }
    log(db, runId, target.id, "info", `Starting Enrichment Waterfall: ${chain.join(" -> ")}`);
    let foundEmail = false;

    
    const result = await executeEnrichmentWaterfall(db, target, chain, runId);
    if (result.email) {
       foundEmail = true;
    }

  } else if (config.action_type === "push_to_hubspot") {
    log(db, runId, target.id, "info", `Starting push to HubSpot...`);
    const row = db.prepare("SELECT api_key FROM integrations WHERE key = 'hubspot' AND is_active = 1").get() as { api_key: string } | undefined;
    if (row && row.api_key) {
      const apiKey = decryptSecret(row.api_key);
      try {
        const payload = {
          properties: {
            firstname: target.first_name || "",
            lastname: target.last_name || "",
            company: target.company || "",
            jobtitle: target.title || "",
            hs_linkedin_url: target.linkedin_url || "",
            email: target.email || ""
          }
        };
        const resObj = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        if (!resObj.ok) {
          let data;
          const text = await resObj.text();
          try { data = JSON.parse(text); } catch (e) { data = text; }
          const err = new Error(`${resObj.status} ${resObj.statusText}: ${typeof data === 'string' ? data.slice(0, 50).replace(/\n/g, '') : JSON.stringify(data).slice(0, 50)}`);
          (err as any).response = { status: resObj.status, data };
          throw err;
        }
        log(db, runId, target.id, "info", `Successfully pushed ${target.first_name || ""} ${target.last_name || ""} to HubSpot CRM`);
      } catch (err: any) {
        if (err.response?.data?.message?.includes("already exists")) {
          log(db, runId, target.id, "info", `Contact already exists in HubSpot`);
        } else {
          log(db, runId, target.id, "error", `Failed to push to HubSpot: ${err.message}`);
        }
      }
    } else {
      log(db, runId, target.id, "warn", `HubSpot integration missing or inactive`);
    }
  }

  return;
}


export async function executeEnrichmentWaterfall(db: ReturnType<typeof getDb>, target: any, chain: string[], runId: string = "manual"): Promise<{ email: string | null; providerUsed: string | null }> {
    let foundEmail = false;
    let providerUsed = null;
    let email = null;
    
    // Convert target to format expected by the logic (making sure it works whether called from UI or Runner)
    if (!target.first_name && target.full_name) {
       const parts = target.full_name.split(" ");
       target.first_name = parts[0];
       target.last_name = parts.slice(1).join(" ");
    }
    
    for (const provider of chain) {
      const row = db.prepare("SELECT api_key, quota_resets_at FROM integrations WHERE key = ? AND is_active = 1").get(provider) as { api_key: string, quota_resets_at: string | null } | undefined;
      if (!row || !row.api_key) continue; // silently skip if somehow missing
      log(db, runId, target.id, "info", `Checking provider: ${provider}...`);
      
      if (row.quota_resets_at && new Date(row.quota_resets_at).getTime() > Date.now()) {
        log(db, runId, target.id, "info", `Skipping ${provider} due to exhausted quota`);
        continue;
      }

      const apiKey = decryptSecret(row.api_key);
      if (!apiKey) continue;

      try {
        let email: string | null = null;
        
        if (provider === "apollo") {
          if (!target.linkedin_url) continue;
          const res = await matchPerson(target.linkedin_url, apiKey);
          if (res?.email) email = res.email;
        } else if (provider === "prospeo") {
          const payload = {
            data: {
              first_name: target.first_name || undefined,
              last_name: target.last_name || undefined,
              company_name: target.company || undefined,
              linkedin_url: target.linkedin_url || undefined
            }
          };
          const resObj = await fetch('https://api.prospeo.io/enrich-person', {
            method: 'POST',
            headers: { 'X-KEY': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          let data;
          const text = await resObj.text();
          try { data = JSON.parse(text); } catch (e) { data = text; }
          const res = { data, status: resObj.status };
          if (!resObj.ok) throw new Error(`${resObj.status} ${resObj.statusText}: ${typeof data === 'string' ? data.slice(0, 50) : JSON.stringify(data).slice(0, 50)}`);
          if (res.data?.person?.email?.email) {
            email = res.data.person.email.email;
          }
        } else if (provider === "hunter") {
          const query = new URLSearchParams({ api_key: apiKey });
          const liMatch = target.linkedin_url ? target.linkedin_url.match(/in\/([^/?#]+)/) : null;
          if (liMatch) {
            query.set("linkedin_handle", liMatch[1]);
          } else {
            if (!target.company) throw new Error("Missing company name required by Hunter.io");
            query.set("first_name", target.first_name || "");
            query.set("last_name", target.last_name || "");
            query.set("company", target.company || "");
          }
          const resObj = await fetch(`https://api.hunter.io/v2/email-finder?${query}`);
          let data;
          const text = await resObj.text();
          try { data = JSON.parse(text); } catch (e) { data = text; }
          const res = { data, status: resObj.status };
          if (!resObj.ok) throw new Error(`${resObj.status} ${resObj.statusText}: ${typeof data === 'string' ? data.slice(0, 50) : JSON.stringify(data).slice(0, 50)}`);
          if (res.data?.data?.email) {
            email = res.data.data.email;
          }
        } else if (provider === "skrapp") {
          const query = new URLSearchParams({
              firstName: target.first_name || "",
              lastName: target.last_name || "",
              company: target.company || ""
            });
            const resObj = await fetch(`https://api.skrapp.io/api/v2/find?${query}`, {
              headers: { 'X-Access-Key': apiKey }
            });
            let data;
          const text = await resObj.text();
          try { data = JSON.parse(text); } catch (e) { data = text; }
          const res = { data, status: resObj.status };
          if (!resObj.ok) throw new Error(`${resObj.status} ${resObj.statusText}: ${typeof data === 'string' ? data.slice(0, 50) : JSON.stringify(data).slice(0, 50)}`);
          if (res.data?.email) email = res.data.email;
        } else if (provider === "snov") {
          const parts = apiKey.split(":");
          if (parts.length !== 2) throw new Error("Snov.io requires Client ID:Client Secret");
          const [clientId, clientSecret] = parts;
          
          const tokenResObj = await fetch("https://api.snov.io/v1/oauth/access_token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId.trim(), client_secret: clientSecret.trim() })
          });
          if (!tokenResObj.ok) throw new Error(`Snov auth failed: ${tokenResObj.status} ${tokenResObj.statusText}`);
          let tokenText = await tokenResObj.text();
          let tokenData; try { tokenData = JSON.parse(tokenText); } catch(e) { tokenData = {}; }
          const token = tokenData.access_token;
          if (!token) throw new Error("Snov.io did not return access_token");
          
          if (target.linkedin_url) {
            await fetch("https://api.snov.io/v1/add-url-for-search", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
              body: JSON.stringify({ url: target.linkedin_url })
            });
            await new Promise(r => setTimeout(r, 3500));
            const getResObj = await fetch(`https://api.snov.io/v1/get-emails-from-url?url=${encodeURIComponent(target.linkedin_url)}`, {
              headers: { "Authorization": `Bearer ${token}` }
            });
            const getData = await getResObj.json();
            if (getData.data?.emails?.length > 0) email = getData.data.emails[0].email;
          } else if (target.first_name && target.last_name && target.company) {
            const addRes = await fetch("https://api.snov.io/v1/add-names-to-find-emails", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
              body: JSON.stringify({ firstName: target.first_name, lastName: target.last_name, domain: target.company })
            });
            await new Promise(r => setTimeout(r, 3500));
            const getResObj = await fetch(`https://api.snov.io/v1/get-emails-from-names?firstName=${encodeURIComponent(target.first_name)}&lastName=${encodeURIComponent(target.last_name)}&domain=${encodeURIComponent(target.company)}`, {
              headers: { "Authorization": `Bearer ${token}` }
            });
            const getData = await getResObj.json();
            if (getData.data?.emails?.length > 0) email = getData.data.emails[0].email;
          }
        } else if (provider === "lusha") {
          const contactPayload: any = {};
          if (target.linkedin_url) {
             contactPayload.linkedinUrl = target.linkedin_url;
          } else {
             contactPayload.firstName = target.first_name || "";
             contactPayload.lastName = target.last_name || "";
             contactPayload.companyName = target.company || "";
          }

          const resObj = await fetch('https://api.lusha.com/v3/contacts/search-and-enrich', {
            method: 'POST',
            headers: { 'api_key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacts: [contactPayload] })
          });
          
          let data;
          const text = await resObj.text();
          try { data = JSON.parse(text); } catch (e) { data = text; }
          const res = { data, status: resObj.status };
          
          if (!resObj.ok) throw new Error(`${resObj.status} ${resObj.statusText}: ${typeof data === 'string' ? data.slice(0, 50) : JSON.stringify(data).slice(0, 50)}`);
          
          // Handle various V3 response wrappers
          const enrichedContact = res.data?.contacts?.[0] || res.data?.data?.contacts?.[0] || res.data?.data || res.data;
          if (enrichedContact?.emailAddresses?.[0]?.email) {
            email = enrichedContact.emailAddresses[0].email;
          }
        } else if (provider === "contactout") {
          const queryParams: Record<string, string> = {};
          if (target.linkedin_url) queryParams.profile = target.linkedin_url;
          else {
            queryParams.first_name = target.first_name || "";
            queryParams.last_name = target.last_name || "";
            queryParams.company = target.company || "";
          }
          const query = new URLSearchParams(queryParams);
          const endpoint = target.linkedin_url ? "people/linkedin" : "email/find";
          const resObj = await fetch(`https://api.contactout.com/v1/${endpoint}?${query}`, {
            headers: { 'token': apiKey }
          });
          let data;
          const text = await resObj.text();
          try { data = JSON.parse(text); } catch (e) { data = text; }
          const res = { data, status: resObj.status };
          if (!resObj.ok) throw new Error(`${resObj.status} ${resObj.statusText}: ${typeof data === 'string' ? data.slice(0, 50).replace(/\n/g, '') : JSON.stringify(data).slice(0, 50)}`);
          
          if (target.linkedin_url && res.data?.profile?.email?.[0]) {
            email = res.data.profile.email[0];
          } else if (res.data?.email) {
            email = Array.isArray(res.data.email) ? res.data.email[0] : res.data.email;
          }
        }

        if (email) {
          db.prepare("UPDATE targets SET email = ? WHERE id = ?").run(email, target.id);
          log(db, runId, target.id, "info", `Email enriched via ${provider}: ${email}`);
          foundEmail = true;
          providerUsed = provider; break;
        }
        
        log(db, runId, target.id, "info", `Provider ${provider} did not find an email`);
      } catch (err: any) {
        const errorMsg = err.message || JSON.stringify(err);
        if (errorMsg.includes('404 Not Found') || errorMsg.includes('404') || errorMsg.includes('not_found')) {
          log(db, runId, target.id, "info", `Provider ${provider} did not find an email (404 Not Found)`);
        } else {
          log(db, runId, target.id, "warn", `${provider} enrichment failed: ${errorMsg}`);
        }
        if (err.response?.status === 402 || err.response?.status === 429 || errorMsg.includes('402') || errorMsg.includes('429')) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          db.prepare("UPDATE integrations SET quota_resets_at = ? WHERE key = ?").run(tomorrow.toISOString(), provider);
        }
      }
    }
    if (!foundEmail) log(db, runId, target.id, "warn", `Enrichment Waterfall finished. No email found across all ${chain.length} providers.`);
    
    return { email: foundEmail ? (target.email || null) : null, providerUsed };
}
