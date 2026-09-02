const fs = require('fs');
let code = fs.readFileSync('pages/contacts/index.tsx', 'utf8');

// Fix import
code = code.replace(/import FilterBar, { ActiveFilter, filtersToParams } from "@\/components\/ui\/FilterBar";/, 
  'import FilterBar, { ActiveFilter, filtersToParams, paramsToFilters } from "@/components/ui/FilterBar";');

// Fix f type
code = code.replace(/const nextSig = JSON.stringify\(qFilters.map\(f => \({ f: f.field, o: f.op, v: f.value }\)\)\);/g, 
  'const nextSig = JSON.stringify(qFilters.map((f: ActiveFilter) => ({ f: f.field, o: f.op, v: f.value })));');
code = code.replace(/const currentSig = JSON.stringify\(filters.map\(f => \({ f: f.field, o: f.op, v: f.value }\)\)\);/g, 
  'const currentSig = JSON.stringify(filters.map((f: ActiveFilter) => ({ f: f.field, o: f.op, v: f.value })));');

// Fix query type for delete
const changeListTarget = `const query = { ...router.query, page: 1, list_id: lid };
    if (!lid) delete query.list_id;`;
const changeListFix = `const query: Record<string, any> = { ...router.query, page: 1, list_id: lid };
    if (!lid) delete query.list_id;`;
code = code.replace(changeListTarget, changeListFix);

const changeSearchTarget = `const query = { ...router.query, page: 1, search: q };
    if (!q) delete query.search;`;
const changeSearchFix = `const query: Record<string, any> = { ...router.query, page: 1, search: q };
    if (!q) delete query.search;`;
code = code.replace(changeSearchTarget, changeSearchFix);

fs.writeFileSync('pages/contacts/index.tsx', code);
