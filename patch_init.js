const fs = require('fs');
let code = fs.readFileSync('pages/contacts/index.tsx', 'utf8');

code = code.replace(/const \[listId, setListId\] = useState\(""\);/, 'const [listId, setListId] = useState(() => (router.query.list_id as string) || "");');
code = code.replace(/const \[search, setSearch\] = useState\(""\);/, 'const [search, setSearch] = useState(() => (router.query.search as string) || "");');
code = code.replace(/const \[debouncedSearch, setDebouncedSearch\] = useState\(""\);/, 'const [debouncedSearch, setDebouncedSearch] = useState(() => (router.query.search as string) || "");');
code = code.replace(/const \[filters, setFilters\] = useState<ActiveFilter\[\]>\(\[\]\);/, 'const [filters, setFilters] = useState<ActiveFilter[]>(() => paramsToFilters(router.query as Record<string, string | string[] | undefined>));');

fs.writeFileSync('pages/contacts/index.tsx', code);
