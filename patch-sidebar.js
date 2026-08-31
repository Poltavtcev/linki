const fs = require('fs');
let code = fs.readFileSync('components/layout/Sidebar.tsx', 'utf8');

if (!code.includes("useTheme")) {
  code = code.replace(
    /import \{ useRouter \} from "next\/router";/,
    `import { useRouter } from "next/router";\nimport { useTheme } from "next-themes";`
  );
}

if (!code.includes("RiMoonLine")) {
  code = code.replace(
    /RiLogoutBoxLine,/,
    `RiLogoutBoxLine,\n  RiMoonLine,\n  RiSunLine,`
  );
}

// Inside the component, add the useTheme hook
code = code.replace(
  /export default function Sidebar\(\{ onCollapse \}: \{ onCollapse: \(c: boolean\) => void \}\) \{/,
  `export default function Sidebar({ onCollapse }: { onCollapse: (c: boolean) => void }) {\n  const { resolvedTheme, setTheme } = useTheme();`
);

// Add the toggle button before Settings
const toggleBtn = `
          <button
            onClick={() => setTheme(resolvedTheme === "notion-light" ? "notion" : "notion-light")}
            className="flex items-center gap-2.5 px-3 h-9 rounded-lg text-sm text-base-content/50 hover:text-base-content/80 hover:bg-base-300/40 transition-colors w-full text-left"
          >
            {resolvedTheme === "notion-light" ? (
              <>
                <RiMoonLine size={14} />
                <span>Dark Mode</span>
              </>
            ) : (
              <>
                <RiSunLine size={14} />
                <span>Light Mode</span>
              </>
            )}
          </button>`;

code = code.replace(
  /\{\/\* Settings \+ signout labels \*\/\}\n\s*<div className="pb-3 border-t border-base-300\/40 pt-3 flex flex-col gap-0\.5 px-2">/,
  `{/* Settings + signout labels */}\n        <div className="pb-3 border-t border-base-300/40 pt-3 flex flex-col gap-0.5 px-2">${toggleBtn}`
);


// For the collapsed state, the toggle button needs an icon-only version
const toggleBtnIcon = `
          <button
            onClick={() => setTheme(resolvedTheme === "notion-light" ? "notion" : "notion-light")}
            title={resolvedTheme === "notion-light" ? "Dark Mode" : "Light Mode"}
            className="flex items-center justify-center h-9 rounded-lg text-base-content/50 hover:text-base-content/80 hover:bg-base-300/40 transition-colors"
          >
            {resolvedTheme === "notion-light" ? <RiMoonLine size={14} /> : <RiSunLine size={14} />}
          </button>`;

// Insert before the Settings icon in collapsed mode
code = code.replace(
  /\{\/\* Settings \+ Sign out icons \*\/\}\n\s*<div className="pb-3 border-t border-base-300\/40 pt-3 flex flex-col gap-0\.5 px-2">/,
  `{/* Settings + Sign out icons */}\n        <div className="pb-3 border-t border-base-300/40 pt-3 flex flex-col gap-0.5 px-2">${toggleBtnIcon}`
);

fs.writeFileSync('components/layout/Sidebar.tsx', code);
