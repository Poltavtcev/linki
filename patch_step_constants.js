const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

code = code.replace(
  `  email: <RiMailLine size={15} />,
  integration: <RiPlugLine size={15} />,`,
  `  email: <RiMailLine size={15} />,
  integration: <RiPlugLine size={15} />,
  change_status: <RiGroupLine size={15} />,`
);

code = code.replace(
  `  email: "Cold Email",
  integration: "HubSpot Push",`,
  `  email: "Cold Email",
  integration: "HubSpot Push",
  change_status: "Change CRM Status",`
);

code = code.replace(
  `  email: "bg-warning/10 text-warning border-warning/20",
  integration: "bg-primary/10 text-primary border-primary/20",`,
  `  email: "bg-warning/10 text-warning border-warning/20",
  integration: "bg-primary/10 text-primary border-primary/20",
  change_status: "bg-secondary/10 text-secondary border-secondary/20",`
);

// Add to the available steps array in the Builder UI
code = code.replace(
  `(["visit", "connect", "message", "sales_inmail", "integration"] as StepType[])`,
  `(["visit", "connect", "message", "sales_inmail", "integration", "change_status"] as StepType[])`
);

fs.writeFileSync('pages/workflows/[id].tsx', code);
