const fs = require('fs');
const content = fs.readFileSync('lib/linkedin/inbox-observer.ts', 'utf8');

let newContent = content.replace(
  /    page\.on\("response", async \(response\) => \{/g,
  `    const responseHandler = async (response: any) => {`
);

newContent = newContent.replace(
  /        \} catch \(err\) \{\}\n      \}/,
  `        } catch (err) { console.error("[observer] Error parsing legacy XHR", err); }
      }`
);

newContent = newContent.replace(
  /    \}\);\n\n    console\.log\(\`\[observer\] Navigating to messaging\.\.\.\`\);\n    await page\.goto/,
  `    };
    page.on("response", responseHandler);

    try {
      console.log(\`[observer] Navigating to messaging...\`);
      await page.goto`
);

newContent = newContent.replace(
  /    console\.log\(\`\[observer\] Captured \$\{observations\.length\} observations from network\.\`\);\n    return observations;\n  \}\n\}/,
  `      console.log(\`[observer] Captured \${observations.length} observations from network.\`);
      return observations;
    } finally {
      page.off("response", responseHandler);
    }
  }
}`
);

fs.writeFileSync('lib/linkedin/inbox-observer.ts', newContent);
