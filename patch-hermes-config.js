const fs = require('fs');
const yaml = require('yaml'); // Node might not have yaml installed globally, fallback to regex or standard string replacement

try {
  let content = fs.readFileSync('/Users/admin/.hermes/config.yaml', 'utf8');
  
  // Strip my-server
  content = content.replace(/  my-server:[\s\S]*?\/path\/to\/dir/g, '');
  
  // Fix linki
  content = content.replace(
    /  linki:\n\s*type: sse\n\s*url: http:\/\/localhost:3000\/api\/mcp\n\s*headers:\n\s*Authorization: Bearer d1c0b9a8f7e6d5c4b3a2f1e6d7c9b8a1/g,
    \`  linki:
    serverUrl: http://localhost:3000/api/mcp
    headers:
      Authorization: Bearer d1c0b9a8f7e6d5c4b3a2f1e6d7c9b8a1\`
  );
  
  // Alternative regex if the user formatted it differently
  content = content.replace(
    /  linki:\s+url: http:\/\/localhost:3000\/api\/mcp\s+headers:\s+Authorization: Bearer d1c0b9a8f7e6d5c4b3a2f1e6d7c9b8a1\s+transport: sse/g,
    \`  linki:
    serverUrl: http://localhost:3000/api/mcp
    headers:
      Authorization: Bearer d1c0b9a8f7e6d5c4b3a2f1e6d7c9b8a1\`
  );

  fs.writeFileSync('/Users/admin/.hermes/config.yaml', content);
  console.log("Patched");
} catch(e) {
  console.error(e);
}
