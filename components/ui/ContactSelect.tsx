import { useState, useEffect, useRef } from "react";
import { RiSearchLine, RiCloseCircleLine } from "react-icons/ri";

interface Target {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name?: string | null;
  company?: string | null; // some APIs return company, some company_name
}

export default function ContactSelect({ 
  value, 
  onChange,
  initialTarget,
  placeholder = "Search contacts..."
}: { 
  value: string; 
  onChange: (id: string) => void;
  initialTarget?: Target | null;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Target[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<Target | null>(initialTarget || null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync prop changes (if value gets cleared from outside)
  useEffect(() => {
    if (!value) {
      setSelectedTarget(null);
      setQuery("");
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      if (query.trim().length < 1) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/targets?search=${encodeURIComponent(query)}&limit=20`);
        const data = await res.json();
        setResults(data.contacts || []);
      } catch (e) {} finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, open]);

  // Handle focus
  function handleFocus() {
    setOpen(true);
    // trigger empty search if we want some initial results, but for now just wait for typing
  }

  if (value && selectedTarget) {
    const name = `${selectedTarget.first_name || ""} ${selectedTarget.last_name || ""}`.trim() || (selectedTarget as any).full_name;
    const comp = selectedTarget.company || selectedTarget.company_name;
    return (
      <div className="relative w-full">
        <div className="w-full flex items-center justify-between pl-4 pr-3 py-2 bg-base-200/60 border border-base-300/40 rounded-xl text-sm text-base-content/80">
          <span className="truncate">{name || "Unnamed"} {comp ? `(${comp})` : ""}</span>
          <button 
            onClick={(e) => { e.preventDefault(); onChange(""); setSelectedTarget(null); setOpen(true); }}
            className="text-base-content/30 hover:text-error transition-colors"
          >
            <RiCloseCircleLine size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <RiSearchLine size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
        <input 
          className="w-full pl-8 pr-3 py-2 bg-base-200/60 border border-base-300/40 rounded-xl text-sm text-base-content/80 focus:outline-none focus:border-base-300/80 transition-colors"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 loading loading-spinner loading-xs text-base-content/30"></span>
        )}
      </div>
      
      {open && query.trim().length > 0 && (
        <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-base-100 border border-base-300 shadow-xl rounded-xl p-1">
          {results.length === 0 && !loading && (
            <div className="p-3 text-xs text-center text-base-content/40">No contacts found</div>
          )}
          {results.map(t => {
            const name = `${t.first_name || ""} ${t.last_name || ""}`.trim() || (t as any).full_name;
            const comp = t.company || t.company_name;
            return (
              <button
                key={t.id}
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedTarget(t);
                  onChange(t.id);
                  setOpen(false);
                  setQuery("");
                }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-base-200 transition-colors flex flex-col"
              >
                <span className="text-sm text-base-content leading-tight">{name || "Unnamed"}</span>
                {comp && <span className="text-xs text-base-content/40 mt-0.5">{comp}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  );
}
