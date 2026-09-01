const fs = require('fs');
let code = fs.readFileSync('pages/settings.tsx', 'utf8');

// Add crm to Tab type
code = code.replace(
  `type Tab = "linkedin" | "email" | "templates" | "integrations" | "general";`, 
  `type Tab = "linkedin" | "email" | "templates" | "integrations" | "general" | "crm";`
);

// Add crm to TABS array
code = code.replace(
  `  { key: "templates", label: "Templates", icon: RiMessage2Line },`,
  `  { key: "templates", label: "Templates", icon: RiMessage2Line },\n  { key: "crm", label: "CRM", icon: RiGroupLine },`
);

// Add import for RiGroupLine if missing
if (!code.includes('RiGroupLine')) {
  code = code.replace(
    `RiSettings3Line,`,
    `RiSettings3Line, RiGroupLine,`
  );
}

// Add rendering in main component
code = code.replace(
  `{tab === "general" && <GeneralTab hasPremium={hasPremium} internalSecret={internalSecret || ""} />}`,
  `{tab === "general" && <GeneralTab hasPremium={hasPremium} internalSecret={internalSecret || ""} />}\n        {tab === "crm" && <CrmTab />}`
);

fs.writeFileSync('pages/settings.tsx', code);
