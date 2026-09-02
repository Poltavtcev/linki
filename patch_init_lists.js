const fs = require('fs');
let code = fs.readFileSync('pages/lists/[id].tsx', 'utf8');

code = code.replace(/const \[search, setSearch\] = useState\(""\);/, 'const [search, setSearch] = useState(() => (router.query.search as string) || "");');
code = code.replace(/const \[filters, setFilters\] = useState<ActiveFilter\[\]>\(\[\]\);/, 'const [filters, setFilters] = useState<ActiveFilter[]>(() => paramsToFilters(router.query as Record<string, string | string[] | undefined>));');

fs.writeFileSync('pages/lists/[id].tsx', code);
