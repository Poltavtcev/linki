const fs = require('fs');
let code = fs.readFileSync('components/ui/FilterBar.tsx', 'utf8');

code = code.replace(/export function paramsToFilters[\s\S]*/, '');

code = code + `
export function paramsToFilters(query: Record<string, string | string[] | undefined>): ActiveFilter[] {
  const parsed: ActiveFilter[] = [];
  let i = 0;
  while (true) {
    const field = query[\`f[\${i}][field]\`];
    if (!field || typeof field !== 'string') break;
    const op = query[\`f[\${i}][op]\`] as FilterOp;
    const value = query[\`f[\${i}][value]\`];
    parsed.push({ id: Math.random().toString(36).slice(2, 9), field, op, value: typeof value === 'string' ? value : undefined });
    i++;
  }
  return parsed;
}
`;
fs.writeFileSync('components/ui/FilterBar.tsx', code);
