const crypto = require('crypto');
const fs = require('fs');

if (fs.existsSync('.env.local')) {
  const env = fs.readFileSync('.env.local', 'utf8');
  env.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2];
  });
}

function decryptSecret(value) {
  if (!value || !value.startsWith("v1:")) return value;
  const secret = process.env.NEXTAUTH_SECRET;
  const key = crypto.hkdfSync("sha256", secret, "", "linki-secret-encryption", 32);
  const [, ivB64, authTagB64, dataB64] = value.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}

async function runTests() {
  const target = {
    first_name: "Dustin",
    last_name: "Moskovitz",
    company: "Asana",
    linkedin_url: "https://www.linkedin.com/in/dmoskovitz/"
  };

  const keys = JSON.parse(fs.readFileSync('keys.json', 'utf8'));

  for (const { provider, encKey } of keys) {
    const apiKey = decryptSecret(encKey);
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
          
          if (target.linkedin_url) {
            await fetch("https://api.snov.io/v1/add-url-for-search", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tokenData.access_token}` },
              body: JSON.stringify({ url: target.linkedin_url })
            });
            const getResObj = await fetch(`https://api.snov.io/v1/get-emails-from-url?url=${encodeURIComponent(target.linkedin_url)}`, {
              headers: { "Authorization": `Bearer ${tokenData.access_token}` }
            });
            console.log("Snov Get Status:", getResObj.status);
            console.log("Snov Response:", (await getResObj.text()).slice(0, 100));
          }
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
