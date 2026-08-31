const fs = require('fs');

function bumpOpacity(file) {
  let code = fs.readFileSync(file, 'utf8');
  
  // Apply bumps using regex
  code = code.replace(/text-base-content\/20/g, 'text-base-content/30');
  code = code.replace(/text-base-content\/25/g, 'text-base-content/40');
  code = code.replace(/text-base-content\/30/g, 'text-base-content/45');
  code = code.replace(/text-base-content\/35/g, 'text-base-content/50');
  code = code.replace(/text-base-content\/40/g, 'text-base-content/60');
  code = code.replace(/text-base-content\/50/g, 'text-base-content/70');
  
  fs.writeFileSync(file, code);
}

bumpOpacity('pages/index.tsx');
bumpOpacity('components/layout/Sidebar.tsx');
