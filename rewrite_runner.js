const fs = require('fs');
let code = fs.readFileSync('lib/integrations/runner.ts', 'utf8');

const snovBlock = `} else if (provider === "snov") {
          // Placeholder for Snov OAuth flow
          log(db, runId, target.id, "info", \`Snov API requires oauth setup, placeholder executed\`);`;

const snovReplacement = `} else if (provider === "snov") {
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
              headers: { "Content-Type": "application/json", "Authorization": \`Bearer \${token}\` },
              body: JSON.stringify({ url: target.linkedin_url })
            });
            await new Promise(r => setTimeout(r, 3500));
            const getResObj = await fetch(\`https://api.snov.io/v1/get-emails-from-url?url=\${encodeURIComponent(target.linkedin_url)}\`, {
              headers: { "Authorization": \`Bearer \${token}\` }
            });
            const getData = await getResObj.json();
            if (getData.data?.emails?.length > 0) email = getData.data.emails[0].email;
          } else if (target.first_name && target.last_name && target.company) {
            const addRes = await fetch("https://api.snov.io/v1/add-names-to-find-emails", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": \`Bearer \${token}\` },
              body: JSON.stringify({ firstName: target.first_name, lastName: target.last_name, domain: target.company })
            });
            await new Promise(r => setTimeout(r, 3500));
            const getResObj = await fetch(\`https://api.snov.io/v1/get-emails-from-names?firstName=\${encodeURIComponent(target.first_name)}&lastName=\${encodeURIComponent(target.last_name)}&domain=\${encodeURIComponent(target.company)}\`, {
              headers: { "Authorization": \`Bearer \${token}\` }
            });
            const getData = await getResObj.json();
            if (getData.data?.emails?.length > 0) email = getData.data.emails[0].email;
          }`;

code = code.replace(snovBlock, snovReplacement);

const contactoutBlock = `} else if (provider === "contactout") {
          const query = new URLSearchParams({
              first_name: target.first_name || "",
              last_name: target.last_name || "",
              company: target.company || ""
            });`;

const contactoutReplacement = `} else if (provider === "contactout") {
          const queryParams: Record<string, string> = {
            first_name: target.first_name || "",
            last_name: target.last_name || "",
            company: target.company || ""
          };
          if (target.linkedin_url) queryParams.profile = target.linkedin_url;
          const query = new URLSearchParams(queryParams);`;

code = code.replace(contactoutBlock, contactoutReplacement);

fs.writeFileSync('lib/integrations/runner.ts', code);
