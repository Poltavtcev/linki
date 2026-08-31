import { getDb } from "@/lib/db";
import { log, trAdvance } from "@/lib/linkedin/runner";
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
    trAdvance(db, tr, steps);
    return;
  }

  let config = { action_type: "enrich_email", provider_chain: [] as string[] };
  try {
    if (step.config && step.config !== "null") {
      const parsed = JSON.parse(step.config);
      if (parsed && typeof parsed === "object") {
        config = parsed;
      }
    }
  } catch (e) {
    log(db, runId, target.id, "error", `Failed to parse integration config: ${(e as Error).message}`);
    trAdvance(db, tr, steps);
    return;
  }

  if (config.action_type === "enrich_email") {
    const chain = config.provider_chain || [];
    let foundEmail = false;

    for (const provider of chain) {
      const row = db.prepare("SELECT api_key, quota_resets_at FROM integrations WHERE key = ? AND is_active = 1").get(provider) as { api_key: string, quota_resets_at: string | null } | undefined;
      if (!row || !row.api_key) continue;
      
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
          const res = { data: await resObj.json(), status: resObj.status };
          if (!resObj.ok) throw { response: res };
          if (res.data?.person?.email?.email) {
            email = res.data.person.email.email;
          }
        } else if (provider === "hunter") {
          const query = new URLSearchParams({
            first_name: target.first_name || "",
            last_name: target.last_name || "",
            company: target.company || "",
            api_key: apiKey
          });
          const resObj = await fetch(`https://api.hunter.io/v2/email-finder?${query}`);
          const res = { data: await resObj.json(), status: resObj.status };
          if (!resObj.ok) throw { response: res };
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
            const res = { data: await resObj.json(), status: resObj.status };
            if (!resObj.ok) throw { response: res };
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
          if (!tokenResObj.ok) throw { response: { status: tokenResObj.status } };
          const token = (await tokenResObj.json()).access_token;
          
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
          const resObj = await fetch('https://api.lusha.com/person', {
            method: 'POST',
            headers: { 'api_key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firstName: target.first_name || "",
              lastName: target.last_name || "",
              company: target.company || ""
            })
          });
          const res = { data: await resObj.json(), status: resObj.status };
          if (!resObj.ok) throw { response: res };
          if (res.data?.data?.emailAddresses?.[0]?.email) {
            email = res.data.data.emailAddresses[0].email;
          }
        } else if (provider === "contactout") {
          const queryParams: Record<string, string> = {
            first_name: target.first_name || "",
            last_name: target.last_name || "",
            company: target.company || ""
          };
          if (target.linkedin_url) queryParams.profile = target.linkedin_url;
          const query = new URLSearchParams(queryParams);
            const resObj = await fetch(`https://api.contactout.com/v1/email/find?${query}`, {
              headers: { 'token': apiKey }
            });
            const res = { data: await resObj.json(), status: resObj.status };
            if (!resObj.ok) throw { response: res };
          if (res.data?.email) email = res.data.email;
        }

        if (email) {
          db.prepare("UPDATE targets SET email = ? WHERE id = ?").run(email, target.id);
          log(db, runId, target.id, "info", `Email enriched via ${provider}: ${email}`);
          foundEmail = true;
          break; // break the waterfall loop
        }
      } catch (err: any) {
        log(db, runId, target.id, "warn", `${provider} enrichment failed: ${err.message}`);
        if (err.response?.status === 402 || err.response?.status === 429) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          db.prepare("UPDATE integrations SET quota_resets_at = ? WHERE key = ?").run(tomorrow.toISOString(), provider);
        }
      }
    }
    
  } else if (config.action_type === "push_to_hubspot") {
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
          const data = await resObj.json();
          throw { response: { status: resObj.status, data } };
        }
        log(db, runId, target.id, "info", `Successfully pushed to HubSpot`);
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

  trAdvance(db, tr, steps);
}
