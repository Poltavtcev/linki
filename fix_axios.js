const fs = require('fs');
let code = fs.readFileSync('lib/integrations/runner.ts', 'utf8');

// Remove axios import
code = code.replace(/import axios from 'axios';\n/, '');

// Convert axios.post('https://api.prospeo.io/enrich-person', payload, { headers: ... })
code = code.replace(
  /const res = await axios\.post\('https:\/\/api\.prospeo\.io\/enrich-person', payload, \{\n\s*headers: \{ 'X-KEY': apiKey, 'Content-Type': 'application\/json' \}\n\s*\}\);/g,
  `const resObj = await fetch('https://api.prospeo.io/enrich-person', {
            method: 'POST',
            headers: { 'X-KEY': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const res = { data: await resObj.json(), status: resObj.status };
          if (!resObj.ok) throw { response: res };`
);

// Convert axios.get('https://api.hunter.io/v2/email-finder', { params: ... })
code = code.replace(
  /const res = await axios\.get\('https:\/\/api\.hunter\.io\/v2\/email-finder', \{\n\s*params: \{\n\s*first_name: target\.first_name \|\| "",\n\s*last_name: target\.last_name \|\| "",\n\s*company: target\.company \|\| "",\n\s*api_key: apiKey\n\s*\}\n\s*\}\);/g,
  `const query = new URLSearchParams({
            first_name: target.first_name || "",
            last_name: target.last_name || "",
            company: target.company || "",
            api_key: apiKey
          });
          const resObj = await fetch(\`https://api.hunter.io/v2/email-finder?\${query}\`);
          const res = { data: await resObj.json(), status: resObj.status };
          if (!resObj.ok) throw { response: res };`
);

// Convert skrapp
code = code.replace(
  /const res = await axios\.get\('https:\/\/api\.skrapp\.io\/api\/v2\/find', \{\n\s*params: \{\n\s*firstName: target\.first_name \|\| "",\n\s*lastName: target\.last_name \|\| "",\n\s*company: target\.company \|\| ""\n\s*\},\n\s*headers: \{ 'X-Access-Key': apiKey \}\n\s*\}\);/g,
  `const query = new URLSearchParams({
              firstName: target.first_name || "",
              lastName: target.last_name || "",
              company: target.company || ""
            });
            const resObj = await fetch(\`https://api.skrapp.io/api/v2/find?\${query}\`, {
              headers: { 'X-Access-Key': apiKey }
            });
            const res = { data: await resObj.json(), status: resObj.status };
            if (!resObj.ok) throw { response: res };`
);

// Convert lusha
code = code.replace(
  /const res = await axios\.post\('https:\/\/api\.lusha\.com\/person', \{\n\s*firstName: target\.first_name \|\| "",\n\s*lastName: target\.last_name \|\| "",\n\s*company: target\.company \|\| ""\n\s*\}, \{\n\s*headers: \{ 'api_key': apiKey \}\n\s*\}\);/g,
  `const resObj = await fetch('https://api.lusha.com/person', {
            method: 'POST',
            headers: { 'api_key': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firstName: target.first_name || "",
              lastName: target.last_name || "",
              company: target.company || ""
            })
          });
          const res = { data: await resObj.json(), status: resObj.status };
          if (!resObj.ok) throw { response: res };`
);

// Convert contactout
code = code.replace(
  /const res = await axios\.get\('https:\/\/api\.contactout\.com\/v1\/email\/find', \{\n\s*params: \{\n\s*first_name: target\.first_name \|\| "",\n\s*last_name: target\.last_name \|\| "",\n\s*company: target\.company \|\| ""\n\s*\},\n\s*headers: \{ 'token': apiKey \}\n\s*\}\);/g,
  `const query = new URLSearchParams({
              first_name: target.first_name || "",
              last_name: target.last_name || "",
              company: target.company || ""
            });
            const resObj = await fetch(\`https://api.contactout.com/v1/email/find?\${query}\`, {
              headers: { 'token': apiKey }
            });
            const res = { data: await resObj.json(), status: resObj.status };
            if (!resObj.ok) throw { response: res };`
);

// Convert hubspot
code = code.replace(
  /await axios\.post\('https:\/\/api\.hubapi\.com\/crm\/v3\/objects\/contacts', payload, \{\n\s*headers: \{\n\s*'Authorization': \`Bearer \$\{apiKey\}\`,\n\s*'Content-Type': 'application\/json'\n\s*\}\n\s*\}\);/g,
  `const resObj = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
          method: 'POST',
          headers: {
            'Authorization': \`Bearer \${apiKey}\`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        if (!resObj.ok) {
          const data = await resObj.json();
          throw { response: { status: resObj.status, data } };
        }`
);

fs.writeFileSync('lib/integrations/runner.ts', code);
