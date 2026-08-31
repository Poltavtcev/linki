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
  const secret = process.env.NEXTAUTH_SECRET;
  const key = crypto.hkdfSync("sha256", secret, "", "linki-secret-encryption", 32);
  const [, ivB64, authTagB64, dataB64] = value.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

async function runTests() {
  const keys = JSON.parse(fs.readFileSync('keys.json', 'utf8'));
  for (const { provider, encKey } of keys) {
    if (provider !== "prospeo") continue;
    const apiKey = decryptSecret(encKey);
    const payload = {
            data: {
              first_name: "Dustin",
              last_name: "Moskovitz",
              company_name: "Asana",
              linkedin_url: "https://www.linkedin.com/in/dmoskovitz/"
            }
          };
          const resObj = await fetch('https://api.prospeo.io/enrich-person', {
            method: 'POST',
            headers: { 'X-KEY': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          console.log(await resObj.text());
  }
}
runTests();
