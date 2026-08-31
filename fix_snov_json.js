const fs = require('fs');
let code = fs.readFileSync('lib/integrations/runner.ts', 'utf8');

const snovTokenAnchor = `          if (!tokenResObj.ok) throw { response: { status: tokenResObj.status } };
          const token = (await tokenResObj.json()).access_token;`;
          
const snovTokenReplacement = `          if (!tokenResObj.ok) throw new Error(\`Snov auth failed: \${tokenResObj.status} \${tokenResObj.statusText}\`);
          let tokenText = await tokenResObj.text();
          let tokenData; try { tokenData = JSON.parse(tokenText); } catch(e) { tokenData = {}; }
          const token = tokenData.access_token;
          if (!token) throw new Error("Snov.io did not return access_token");`;

code = code.replace(snovTokenAnchor, snovTokenReplacement);

const snovGetUrlAnchor = `            const getResObj = await fetch(\`https://api.snov.io/v1/get-emails-from-url?url=\\\$\\{encodeURIComponent(target.linkedin_url)\\}\`, {
              headers: { "Authorization": \`Bearer \\\$\\{token\\}\` }
            });
            const getData = await getResObj.json();`;

const snovGetUrlReplacement = `            const getResObj = await fetch(\`https://api.snov.io/v1/get-emails-from-url?url=\${encodeURIComponent(target.linkedin_url)}\`, {
              headers: { "Authorization": \`Bearer \${token}\` }
            });
            let getText = await getResObj.text();
            let getData; try { getData = JSON.parse(getText); } catch(e) { getData = {}; }
            if (!getResObj.ok) throw new Error(\`Snov fetch failed: \${getResObj.status} \${getResObj.statusText}\`);`;

code = code.replace(snovGetUrlAnchor, snovGetUrlReplacement);

const snovGetNameAnchor = `            const getResObj = await fetch(\`https://api.snov.io/v1/get-emails-from-names?firstName=\\\$\\{encodeURIComponent(target.first_name)\\}&lastName=\\\$\\{encodeURIComponent(target.last_name)\\}&domain=\\\$\\{encodeURIComponent(target.company)\\}\`, {
              headers: { "Authorization": \`Bearer \\\$\\{token\\}\` }
            });
            const getData = await getResObj.json();`;

const snovGetNameReplacement = `            const getResObj = await fetch(\`https://api.snov.io/v1/get-emails-from-names?firstName=\${encodeURIComponent(target.first_name)}&lastName=\${encodeURIComponent(target.last_name)}&domain=\${encodeURIComponent(target.company)}\`, {
              headers: { "Authorization": \`Bearer \${token}\` }
            });
            let getText = await getResObj.text();
            let getData; try { getData = JSON.parse(getText); } catch(e) { getData = {}; }
            if (!getResObj.ok) throw new Error(\`Snov fetch failed: \${getResObj.status} \${getResObj.statusText}\`);`;

code = code.replace(snovGetNameAnchor, snovGetNameReplacement);

fs.writeFileSync('lib/integrations/runner.ts', code);
