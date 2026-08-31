const fs = require('fs');
let code = fs.readFileSync('pages/settings.tsx', 'utf8');

code = code.replace(
  /const cliCommand = \`claude mcp add --transport http linki \$\{mcpUrl\}\`;/,
  'const cliCommand = `claude mcp add --transport sse --header "Authorization: Bearer ${internalSecret}" linki ${mcpUrl}`;'
);

fs.writeFileSync('pages/settings.tsx', code);
