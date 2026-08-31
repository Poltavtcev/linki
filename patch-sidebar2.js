const fs = require('fs');
let code = fs.readFileSync('components/layout/Sidebar.tsx', 'utf8');

code = code.replace(
  /export default function Sidebar\(\{ onCollapse \}: \{ onCollapse\?: \(collapsed: boolean\) => void \}\) \{/,
  `export default function Sidebar({ onCollapse }: { onCollapse?: (collapsed: boolean) => void }) {\n  const { resolvedTheme, setTheme } = useTheme();`
);

fs.writeFileSync('components/layout/Sidebar.tsx', code);
