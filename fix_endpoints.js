const fs = require('fs');
let code = fs.readFileSync('lib/integrations/runner.ts', 'utf8');

// Fix Lusha Endpoint
code = code.replace(
  /'https:\/\/api.lusha.com\/person'/,
  "'https://api.lusha.com/v2/person'"
);

// Fix ContactOut Endpoint and Extraction
const coOld = `        } else if (provider === "contactout") {
          const queryParams: Record<string, string> = {
            first_name: target.first_name || "",
            last_name: target.last_name || "",
            company: target.company || ""
          };
          if (target.linkedin_url) queryParams.profile = target.linkedin_url;
          const query = new URLSearchParams(queryParams);
            const resObj = await fetch(\`https://api.contactout.com/v1/email/find?\${query}\`, {
              headers: { 'token': apiKey }
            });
            let data;
          const text = await resObj.text();
          try { data = JSON.parse(text); } catch (e) { data = text; }
          const res = { data, status: resObj.status };
          if (!resObj.ok) {
            const err = new Error(\`\${resObj.status} \${resObj.statusText}: \${typeof data === 'string' ? data.slice(0, 50).replace(/\\n/g, '') : JSON.stringify(data).slice(0, 50)}\`);
            (err as any).response = res;
            throw err;
          }
          if (res.data?.email) email = res.data.email;
        }`;

const coNew = `        } else if (provider === "contactout") {
          const queryParams: Record<string, string> = {};
          if (target.linkedin_url) queryParams.profile = target.linkedin_url;
          else {
            queryParams.first_name = target.first_name || "";
            queryParams.last_name = target.last_name || "";
            queryParams.company = target.company || "";
          }
          const query = new URLSearchParams(queryParams);
          const endpoint = target.linkedin_url ? "people/linkedin" : "email/find";
          const resObj = await fetch(\`https://api.contactout.com/v1/\${endpoint}?\${query}\`, {
            headers: { 'token': apiKey }
          });
          let data;
          const text = await resObj.text();
          try { data = JSON.parse(text); } catch (e) { data = text; }
          const res = { data, status: resObj.status };
          if (!resObj.ok) {
            const err = new Error(\`\${resObj.status} \${resObj.statusText}: \${typeof data === 'string' ? data.slice(0, 50).replace(/\\n/g, '') : JSON.stringify(data).slice(0, 50)}\`);
            (err as any).response = res;
            throw err;
          }
          
          if (target.linkedin_url && res.data?.profile?.email?.[0]) {
            email = res.data.profile.email[0];
          } else if (res.data?.email) {
            email = Array.isArray(res.data.email) ? res.data.email[0] : res.data.email;
          }
        }`;

code = code.replace(coOld, coNew);
fs.writeFileSync('lib/integrations/runner.ts', code);
