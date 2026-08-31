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
    if (provider !== "contactout") continue;
    const apiKey = decryptSecret(encKey);
    console.log(`\n--- Testing ${provider} ---`);

    try {
        const queryParams = { profile: target.linkedin_url };
        const query = new URLSearchParams(queryParams);
        const resObj = await fetch(`https://api.contactout.com/v1/people/linkedin?${query}`, {
          headers: { 'token': apiKey, 'Content-Type': 'application/json' }
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
