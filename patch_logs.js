const fs = require('fs');
let code = fs.readFileSync('lib/integrations/runner.ts', 'utf8');

// 1. Remove "Starting Enrichment Waterfall"
code = code.replace(/log\(db, runId, target\.id, "info", \`Starting Enrichment Waterfall: \$\{chain\.join\(" -> "\)\}\`\);/g, '');

// 2. Remove "Checking provider"
code = code.replace(/log\(db, runId, target\.id, "info", \`Checking provider: \$\{provider\}\.\.\.\`\);/g, '');

// 3. Remove "Skipping ... - API key is missing"
code = code.replace(/log\(db, runId, target\.id, "warn", \`Skipping \$\{provider\} - API key is missing or inactive\`\);/g, '');

// 4. Remove "Provider did not find an email"
code = code.replace(/log\(db, runId, target\.id, "info", \`Provider \$\{provider\} did not find an email\`\);/g, '');

// 5. Remove "enrichment failed" (but keep the quota update logic intact)
const errAnchor = `      } catch (err: any) {
        log(db, runId, target.id, "warn", \`\${provider} enrichment failed: \${err.message || JSON.stringify(err)}\`);
        if (err.response?.status === 402`;
const errReplacement = `      } catch (err: any) {
        if (err.response?.status === 402`;
code = code.replace(errAnchor, errReplacement);

// 6. Simplify the final message
code = code.replace(
  /log\(db, runId, target\.id, "warn", \`Enrichment Waterfall finished\. No email found across all \$\{chain\.length\} providers\.\`\);/g,
  `log(db, runId, target.id, "warn", \`Enrichment Waterfall: No email found (\${chain.length} providers checked)\`);`
);

// 7. Remove "Starting push to HubSpot"
code = code.replace(/log\(db, runId, target\.id, "info", \`Starting push to HubSpot\.\.\.\`\);/g, '');

fs.writeFileSync('lib/integrations/runner.ts', code);
