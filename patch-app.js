const fs = require('fs');
let code = fs.readFileSync('pages/_app.tsx', 'utf8');

code = code.replace(
  /import { Toaster } from "sonner";/,
  `import { Toaster } from "sonner";\nimport { ThemeProvider, useTheme } from "next-themes";`
);

// We need an inner component to consume useTheme for Toaster
code = code.replace(
  /export default function App\(\{ Component, pageProps: \{ session, \.\.\.pageProps \} \}: AppProps\) \{/,
  `function ToasterWithTheme() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme === "notion-light" ? "light" : "dark"} position="bottom-right" />;
}

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {`
);

code = code.replace(
  /<Toaster theme="dark" position="bottom-right" \/>/,
  `<ToasterWithTheme />`
);

code = code.replace(
  /<Layout>/,
  `<ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem themes={['notion', 'notion-light']} value={{ dark: 'notion', light: 'notion-light' }}>
          <Layout>`
);

code = code.replace(
  /<\/Layout>/,
  `</Layout>\n        </ThemeProvider>`
);

fs.writeFileSync('pages/_app.tsx', code);
