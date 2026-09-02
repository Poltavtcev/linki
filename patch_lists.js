const fs = require('fs');
let code = fs.readFileSync('pages/lists/[id].tsx', 'utf8');

// 1. Add paramsToFilters import
if (!code.includes('paramsToFilters')) {
  code = code.replace(/import FilterBar, { ActiveFilter, applyFiltersClient } from "@\/components\/ui\/FilterBar";/, 
    'import FilterBar, { ActiveFilter, applyFiltersClient, filtersToParams, paramsToFilters } from "@/components/ui/FilterBar";');
}

// 2. Modify state declarations and add useEffect
const targetStates = `  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ActiveFilter[]>([]);`;

const newStates = `  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ActiveFilter[]>([]);

  // Sync URL changes BACK to state (e.g. Browser Back Button)
  useEffect(() => {
    if (!router.isReady) return;
    const qSearch = (router.query.search as string) || "";
    if (search !== qSearch) setSearch(qSearch);

    const qFilters = paramsToFilters(router.query as Record<string, string | string[] | undefined>);
    const currentSig = JSON.stringify(filters.map((f: ActiveFilter) => ({ f: f.field, o: f.op, v: f.value })));
    const nextSig = JSON.stringify(qFilters.map((f: ActiveFilter) => ({ f: f.field, o: f.op, v: f.value })));
    if (currentSig !== nextSig) {
      setFilters(qFilters);
    }
  }, [router.query, router.isReady]); // intentionally omit search, filters`;

code = code.replace(targetStates, newStates);

// 3. Update onChange handlers in the UI
const searchOnChange = `onChange={(e) => { setSearch(e.target.value); setPage(0); }}`;
const newSearchOnChange = `onChange={(e) => {
                const q = e.target.value;
                setSearch(q); 
                setPage(0);
                const query: Record<string, any> = { ...router.query, page: 1, search: q };
                if (!q) delete query.search;
                router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
              }}`;
code = code.replace(searchOnChange, newSearchOnChange);

const filterOnChange = `onChange={(f) => { setFilters(f); setPage(0); }}`;
const newFilterOnChange = `onChange={(f) => {
              setFilters(f); 
              setPage(0);
              const query: Record<string, any> = { ...router.query, page: 1 };
              Object.keys(query).forEach(k => { if (k.startsWith('f[')) delete query[k]; });
              const fp = filtersToParams(f);
              fp.forEach((v, k) => query[k] = v);
              router.push({ pathname: router.pathname, query }, undefined, { shallow: true });
            }}`;
code = code.replace(filterOnChange, newFilterOnChange);

fs.writeFileSync('pages/lists/[id].tsx', code);
