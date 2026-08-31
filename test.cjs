const { getDb } = require('./lib/db');
const { decryptSecret } = require('./lib/crypto');
const fs = require('fs');
const fetch = require('node-fetch');

if (fs.existsSync('.env.local')) {
  const env = fs.readFileSync('.env.local', 'utf8');
  env.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2];
  });
}

const db = getDb();

async function runTests() {
  console.log("=== INTEGRATION TESTS ===");
  
  const target = {
    first_name: "Dustin",
    last_name: "Moskovitz",
    company: "Asana",
    linkedin_url: "https://www.linkedin.com/in/dmoskovitz/"
  };

  const rows = db.prepare("SELECT key, api_key FROM integrations WHERE is_active = 1").all();
  
  for (const row of rows) {
    const provider = row.key;
    const apiKey = decryptSecret(row.api_key);
    console.log(`\n--- Testing ${provider} ---`);
    if (!apiKey) {
      console.log("No API key found.");
      continue;
    }

    try {
      if (provider === "apollo") {
        console.log("Calling Apollo API...");
        const resObj = await fetch('https://api.apollo.io/api/v1/people/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
          body: JSON.stringify({ linkedin_url: target.linkedin_url, reveal_personal_emails: false })
        });
        const text = await resObj.text();
        console.log("Status:", resObj.status, resObj.statusText);
        console.log("Response:", text.slice(0, 100).replace(/\n/g, ''));
      } else if (provider === "prospeo") {
        const payload = {
            data: {
              first_name: target.first_name,
              last_name: target.last_name,
              company_name: target.company,
              linkedin_url: target.linkedin_url
            }
          };
          const resObj = await fetch('https://api.prospeo.io/enrich-person', {
            method: 'POST',
            headers: { 'X-KEY': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const text = await resObj.text();
          console.log("Status:", resObj.status, resObj.statusText);
          console.log("Response:", text.slice(0, 100).replace(/\n/g, ''));
      } else if (provider === "hunter") {
        const query = new URLSearchParams({
            first_name: target.first_name,
            last_name: target.last_name,
            company: target.company,
            api_key: apiKey
          });
          const resObj = await fetch(`https://api.hunter.io/v2/email-finder?${query}`);
          const text = await resObj.text();
          console.log("Status:", resObj.status, resObj.statusText);
          console.log("Response:", text.slice(0, 100).replace(/\n/g, ''));
      } else if (provider === "skrapp") {
          const query = new URLSearchParams({
              firstName: target.first_name,
              lastName: target.last_name,
              company: target.company
            });
            const resObj = await fetch(`https://api.skrapp.io/api/v2/find?${query}`, {
              headers: { 'X-Access-Key': apiKey }
            });
            const text = await resObj.text();
          console.log("Status:", resObj.status, resObj.statusText);
          console.log("Response:", text.slice(0, 100).replace(/\n/g, ''));
      } else if (provider === "lusha") {
          const resObj = await fetch('https://api.lusha.com/person', {
            method: 'POST',
            headers: { 'api_key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firstName: target.first_name,
              lastName: target.last_name,
              company: target.company
            })
          });
          const text = await resObj.text();
          console.log("Status:", resObj.status, resObj.statusText);
          console.log("Response:", text.slice(0, 100).replace(/\n/g, ''));
      } else if (provider === "contactout") {
          const queryParams = {
            first_name: target.first_name,
            last_name: target.last_name,
            company: target.company,
            profile: target.linkedin_url
          };
          const query = new URLSearchParams(queryParams);
            const resObj = await fetch(`https://api.contactout.com/v1/email/find?${query}`, {
              headers: { 'token': apiKey }
            });
            const text = await resObj.text();
          console.log("Status:", resObj.status, resObj.statusText);
          console.log("Response:", text.slice(0, 100).replace(/\n/g, ''));
      } else if (provider === "snov") {
          const parts = apiKey.split(":");
          if (parts.length !== 2) throw new Error("Snov.io requires Client ID:Client Secret");
          const [clientId, clientSecret] = parts;
          
          const tokenResObj = await fetch("https://api.snov.io/v1/oauth/access_token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId.trim(), client_secret: clientSecret.trim() })
          });
          const tokenText = await tokenResObj.text();
          console.log("Token Status:", tokenResObj.status);
          if (!tokenResObj.ok) { console.log("Token Error:", tokenText); continue; }
          const tokenData = JSON.parse(tokenText);
          console.log("Got Snov token:", !!tokenData.access_token);
      } else if (provider === "hubspot") {
        const payload = {
          properties: {
            firstname: target.first_name || "",
            lastname: target.last_name || "",
            company: target.company || "",
            hs_linkedin_url: target.linkedin_url || "",
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
        console.log("HubSpot Status:", resObj.status);
        console.log("Response:", (await resObj.text()).slice(0, 100).replace(/\n/g, ''));
      }
    } catch (e) {
      console.log("Error:", e.message);
    }
  }
}

runTests();
