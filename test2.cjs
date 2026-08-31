const { getDb } = require('./lib/db');
const { decryptSecret } = require('./lib/crypto');
const fs = require('fs');

if (fs.existsSync('.env.local')) {
  const env = fs.readFileSync('.env.local', 'utf8');
  env.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) process.env[match[1]] = match[2];
  });
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
    if (provider !== "contactout") continue;
    const apiKey = decryptSecret(encKey);
    console.log(`\n--- Testing ${provider} ---`);

    try {
        const queryParams = { profile: target.linkedin_url };
        const query = new URLSearchParams(queryParams);
        const resObj = await fetch(`https://api.contactout.com/v1/people/linkedin?${query}`, {
          headers: { 'token': apiKey }
        });
        const text = await resObj.text();
        console.log("Status:", resObj.status, resObj.statusText);
        console.log("Response:", text.slice(0, 200).replace(/\n/g, ''));
    } catch (e) {
      console.log("Error:", e.message);
    }
  }
}

runTests();
