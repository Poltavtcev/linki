const fs = require('fs');
let code = fs.readFileSync('styles/globals.css', 'utf8');

// Replace the daisyui plugin themes array
code = code.replace(
  /themes: notion --default;/,
  `themes: notion --default, notion-light;`
);

// Insert notion-light theme
const lightTheme = `
@plugin "daisyui/theme" {
  name: "notion-light";
  default: false;
  color-scheme: light;
  --color-base-100: #ffffff;
  --color-base-200: #f7f7f5;
  --color-base-300: #efefed;
  --color-base-content: #37352f;
  --color-primary: #2382fc;
  --color-primary-content: #ffffff;
  --color-neutral: #efefed;
  --color-neutral-content: #37352f;
  --color-info: #5aa2ff;
  --color-success: #32d583;
  --color-warning: #f4b740;
  --color-error: #ff6b6b;
}
`;

code = code.replace(
  /--color-error: #ff6b6b;\n\}/,
  `--color-error: #ff6b6b;\n}\n\n${lightTheme}`
);

// Remove hardcoded html, body colors and rely on variables
code = code.replace(
  /html,\nbody \{\n  height: 100%;\n  margin: 0;\n  padding: 0;\n  background: #0f0f0f;\n  color: #e6e6e6;\n  font-family: "IBM Plex Sans", system-ui, -apple-system, sans-serif;\n  letter-spacing: -0\.01em;\n  color-scheme: dark;\n\}/,
  `html,\nbody {\n  height: 100%;\n  margin: 0;\n  padding: 0;\n  background: var(--color-base-100, #0f0f0f);\n  color: var(--color-base-content, #e6e6e6);\n  font-family: "IBM Plex Sans", system-ui, -apple-system, sans-serif;\n  letter-spacing: -0.01em;\n}`
);

// Fix scrollbar to use CSS variables so they adapt
code = code.replace(
  /scrollbar-color: rgba\(255, 255, 255, 0\.12\) transparent;/,
  `scrollbar-color: color-mix(in srgb, var(--color-base-content) 12%, transparent) transparent;`
);

code = code.replace(
  /::-webkit-scrollbar-thumb \{\n  background: rgba\(255, 255, 255, 0\.12\);\n  border-radius: 3px;\n\}/,
  `::-webkit-scrollbar-thumb {\n  background: color-mix(in srgb, var(--color-base-content) 12%, transparent);\n  border-radius: 3px;\n}`
);

code = code.replace(
  /::-webkit-scrollbar-thumb:hover \{\n  background: rgba\(255, 255, 255, 0\.18\);\n\}/,
  `::-webkit-scrollbar-thumb:hover {\n  background: color-mix(in srgb, var(--color-base-content) 18%, transparent);\n}`
);

// Fix driver.js to use CSS variables instead of hardcoded hex
code = code.replace(/background: #141414;/g, `background: var(--color-base-200);`);
code = code.replace(/border: 1px solid #1f1f1f;/g, `border: 1px solid var(--color-base-300);`);
code = code.replace(/color: #e6e6e6;/g, `color: var(--color-base-content);`);
code = code.replace(/color: rgba\(230, 230, 230, 0\.7\);/g, `color: color-mix(in srgb, var(--color-base-content) 70%, transparent);`);
code = code.replace(/color: rgba\(230, 230, 230, 0\.3\);/g, `color: color-mix(in srgb, var(--color-base-content) 30%, transparent);`);
code = code.replace(/background: #1f1f1f;/g, `background: var(--color-base-300);`);
code = code.replace(/border: 1px solid #1f1f1f;/g, `border: 1px solid var(--color-base-300);`);
code = code.replace(/color: rgba\(230, 230, 230, 0\.4\);/g, `color: color-mix(in srgb, var(--color-base-content) 40%, transparent);`);
code = code.replace(/border-left-color: #141414;/g, `border-left-color: var(--color-base-200);`);
code = code.replace(/border-right-color: #141414;/g, `border-right-color: var(--color-base-200);`);
code = code.replace(/border-top-color: #141414;/g, `border-top-color: var(--color-base-200);`);
code = code.replace(/border-bottom-color: #141414;/g, `border-bottom-color: var(--color-base-200);`);

fs.writeFileSync('styles/globals.css', code);
