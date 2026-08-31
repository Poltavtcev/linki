# ISA: Light Theme Implementation

## 1. Goal
Implement a robust, toggleable Light/Dark theme system for the Linki application without breaking existing UI components or layout. The application must support seamless switching and respect system preferences.

## 2. Mandatory Protocol

### Phase 1: Audit (Pre-Implementation)
Before any CSS or component changes are made, the agent MUST perform a comprehensive audit of:
- **`styles/globals.css`**: Check existing CSS variables (`--background`, `--foreground`, etc.) and ensure they are split into `:root` (light) and `.dark` (dark) scopes.
- **Tailwind Config (`tailwind.config.ts`)**: Verify that `darkMode: 'class'` is configured correctly.
- **Next-Themes**: Check if `next-themes` is installed and used in `_app.tsx` or `layout.tsx` (ThemeProvider).
- **Hardcoded Colors**: Search the codebase (`components/`, `pages/`, etc.) for hardcoded utility classes that lack dark mode variants (e.g., `bg-white` without `dark:bg-slate-900`) or rely on absolute colors instead of semantic CSS variables (e.g., `bg-zinc-900` instead of `bg-background`).

### Phase 2: Implementation
- Install and configure `next-themes` (if not present).
- Wrap the application in `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`.
- Refactor `globals.css` to properly define both light and dark semantic variables (Shadcn standard).
- Add a Theme Toggle component (usually in the Navbar or Sidebar).
- Clean up hardcoded Tailwind colors identified during the audit.

### Phase 3: Testing & Verification
- **Compilation Check**: Verify `npm run build` succeeds without TS/Tailwind errors.
- **Visual E2E Verification**: The agent or operator MUST run the application and visually verify that both modes render text, backgrounds, borders, and charts (if any) correctly without contrast issues.
