const fs = require('fs');
let code = fs.readFileSync('components/layout/Sidebar.tsx', 'utf8');

// Replace hex colors with css variables in mainNav
code = code.replace(/color: "#5aa2ff"/, 'color: "var(--nav-blue)"');
code = code.replace(/color: "#32d583"/, 'color: "var(--nav-green)"');
code = code.replace(/color: "#34d399"/, 'color: "var(--nav-emerald)"');
code = code.replace(/color: "#a78bfa"/, 'color: "var(--nav-purple)"');
code = code.replace(/color: "#f4b740"/, 'color: "var(--nav-yellow)"');
code = code.replace(/color: "#38bdf8"/, 'color: "var(--nav-sky)"');
code = code.replace(/color: "#f4b740"/, 'color: "var(--nav-yellow)"');
code = code.replace(/color: "#fb923c"/, 'color: "var(--nav-orange)"');

// Same for premiumNav
code = code.replace(/color: "#a78bfa"/g, 'color: "var(--nav-purple)"');
code = code.replace(/color: "#34d399"/g, 'color: "var(--nav-emerald)"');
code = code.replace(/color: "#fb923c"/g, 'color: "var(--nav-orange)"');

// Replace hex alpha active background with color-mix
code = code.replace(
  /\`\$\{item\.color\}22\`/g,
  `"color-mix(in srgb, " + item.color + " 15%, transparent)"`
);

fs.writeFileSync('components/layout/Sidebar.tsx', code);
