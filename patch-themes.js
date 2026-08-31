const fs = require('fs');

// Patch _app.tsx
let appCode = fs.readFileSync('pages/_app.tsx', 'utf8');

// Change the Toaster check to look for "light"
appCode = appCode.replace(
  /resolvedTheme === "notion-light"/,
  `resolvedTheme === "light"`
);

fs.writeFileSync('pages/_app.tsx', appCode);

// Patch Sidebar.tsx
let sidebarCode = fs.readFileSync('components/layout/Sidebar.tsx', 'utf8');

sidebarCode = sidebarCode.replace(
  /resolvedTheme === "notion-light" \? "notion" : "notion-light"/g,
  `resolvedTheme === "light" ? "dark" : "light"`
);

sidebarCode = sidebarCode.replace(
  /resolvedTheme === "notion-light"/g,
  `resolvedTheme === "light"`
);

fs.writeFileSync('components/layout/Sidebar.tsx', sidebarCode);
