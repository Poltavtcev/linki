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

  let config;
  try {
    config = JSON.parse(step.config);
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
          // Placeholder for Snov OAuth flow
          log(db, runId, target.id, "info", `Snov API requires oauth setup, placeholder executed`);
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
          const query = new URLSearchParams({
              first_name: target.first_name || "",
              last_name: target.last_name || "",
              company: target.company || ""
            });
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
