const fs = require('fs');
let code = fs.readFileSync('pages/companies/[id].tsx', 'utf8');

// 1. Add useState, useEffect, and RiAddLine, RiSearchLine to imports
code = code.replace(
  /import \{ RiArrowLeftLine, /g,
  `import { useState, useEffect } from "react";\nimport { RiArrowLeftLine, RiAddLine, RiSearchLine, `
);

// 2. Add state variables inside default export function
code = code.replace(
  /export default function CompanyDetailPage\(\{ company \}: \{ company: Company \}\) \{/,
  `export default function CompanyDetailPage({ company: initialCompany }: { company: Company }) {
  const [company, setCompany] = useState(initialCompany);
  const [showAddContact, setShowAddContact] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (!showAddContact) {
      setSearchQuery("");
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        const res = await fetch(\`/api/targets?search=\$\{encodeURIComponent(searchQuery)\}&limit=10\`);
        const data = await res.json();
        setSearchResults(data.contacts || []);
      } catch(e) {
        console.error(e);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, showAddContact]);

  async function linkContact(targetId: string) {
    try {
      const res = await fetch(\`/api/targets/\$\{targetId\}\`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: company.id }),
      });
      if (res.ok) {
        // We do not have toast imported, let's just console.log or use standard alert if toast fails, 
        // wait, we can just fetch fresh company and we'll see it updated.
        setShowAddContact(false);
        const fresh = await fetch(\`/api/companies/\$\{company.id\}\`).then(r => r.json());
        setCompany(fresh);
      } else {
        alert("Failed to link contact");
      }
    } catch (e) {
      alert("Error linking contact");
    }
  }

  async function unlinkContact(targetId: string) {
    if (!confirm("Remove contact from this company?")) return;
    try {
      const res = await fetch(\`/api/targets/\$\{targetId\}\`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: null }),
      });
      if (res.ok) {
        const fresh = await fetch(\`/api/companies/\$\{company.id\}\`).then(r => r.json());
        setCompany(fresh);
      }
    } catch(e) {
      alert("Error unlinking");
    }
  }`
);

// 3. Replace the Contacts header with the new one
code = code.replace(
  /<p className="text-\[11px\] text-base-content\/40 uppercase tracking-wide mb-3">\s*Contacts \(\{company\.contacts\.length\}\)\s*<\/p>/,
  `<div className="flex items-center justify-between mb-3">
            <p className="text-[11px] text-base-content/40 uppercase tracking-wide">
              Contacts ({company.contacts.length})
            </p>
            <button
              onClick={() => setShowAddContact(true)}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-base-content/50 hover:bg-base-300 hover:text-base-content transition-colors"
            >
              <RiAddLine size={12} />
              Add Contact
            </button>
          </div>`
);

// 4. Add unlink button (X) to each contact
code = code.replace(
  /\{c\.linkedin_url && \(\s*<a href=\{c\.linkedin_url\}[\s\S]*?<\/a>\s*\)\}/,
  `{c.linkedin_url && (
                      <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-base-content/30 hover:text-base-content/60 transition-colors">
                        <RiExternalLinkLine size={13} />
                      </a>
                    )}
                    <button onClick={() => unlinkContact(c.id)} className="text-base-content/20 hover:text-error transition-colors ml-1" title="Unlink contact">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>`
);

// 5. Add Modal at the end of the file
code = code.replace(
  /<\/Layout>\s*\);\s*\}\s*$/m,
  `
      {/* Add Contact Modal */}
      {showAddContact && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-base-100/80 backdrop-blur-sm">
          <div className="bg-base-200 border border-base-300 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-base-300/50">
              <h3 className="font-semibold text-sm text-base-content">Link Contact</h3>
              <button onClick={() => setShowAddContact(false)} className="text-base-content/40 hover:text-base-content">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
            <div className="p-4">
              <div className="relative mb-4">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30">
                  <RiSearchLine size={14} />
                </span>
                <input
                  type="text"
                  autoFocus
                  className="w-full bg-base-100 border border-base-300 rounded-lg pl-9 pr-3 py-2 text-sm text-base-content focus:outline-none focus:border-primary/40"
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/30">
                    <span className="loading loading-spinner loading-xs"></span>
                  </span>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {searchResults.length === 0 && searchQuery.length > 1 && !searchLoading && (
                  <div className="text-center py-4 text-xs text-base-content/40">No contacts found</div>
                )}
                {searchResults.map(c => (
                  <button
                    key={c.id}
                    onClick={() => linkContact(c.id)}
                    className="w-full flex flex-col text-left px-3 py-2 rounded-lg hover:bg-base-300/50 transition-colors"
                  >
                    <span className="text-sm font-medium text-base-content">{c.full_name}</span>
                    <span className="text-xs text-base-content/40">{c.title || "No title"}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
`
);

fs.writeFileSync('pages/companies/[id].tsx', code);
