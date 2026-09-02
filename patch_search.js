const fs = require('fs');
let code = fs.readFileSync('pages/contacts/index.tsx', 'utf8');

// Change changeSearch to use router.replace
const target = `function changeSearch(q: string) { 
    setSearch(q); 
    setPage(0); 
    const query: Record<string, any> = { ...router.query, page: 1, search: q };
    if (!q) delete query.search;
    router.push({ pathname: router.pathname, query }, undefined, { shallow: true });
  }`;

const fix = `function changeSearch(q: string) { 
    setSearch(q); 
    setPage(0); 
    const query: Record<string, any> = { ...router.query, page: 1, search: q };
    if (!q) delete query.search;
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true });
  }`;

code = code.replace(target, fix);
fs.writeFileSync('pages/contacts/index.tsx', code);
