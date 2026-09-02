import Head from "next/head";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getDb } from "@/lib/db";
import {
  RiArrowLeftLine, RiAddLine, RiSearchLine, RiExternalLinkLine, RiGlobalLine,
  RiMapPinLine, RiBuildingLine, RiLinkedinBoxLine, RiUserLine,
  RiMailLine, RiPhoneLine, RiMoneyDollarCircleLine, RiCalendarLine,
  RiGroupLine, RiCodeBoxLine, RiPriceTagLine, RiErrorWarningLine,
  RiEditLine, RiCheckLine, RiCloseLine,
} from "react-icons/ri";

interface Contact {
  id: string;
  full_name: string | null;
  title: string | null;
  email: string | null;
  email_status: string | null;
  seniority: string | null;
  linkedin_url: string | null;
  degree: number | null;
  connected_at: string | null;
}

interface Company {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  location: string | null;
  city: string | null;
  country: string | null;
  linkedin_url: string | null;
  website: string | null;
  description: string | null;
  employee_count: number | null;
  founded_year: number | null;
  annual_revenue: string | null;
  phone: string | null;
  technology_names: string | null;
  keywords: string | null;
  notes: string | null;
  email_domain_invalid: number | null;
  created_at: string;
  contacts: Contact[];
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const db = getDb();
  const id = params?.id as string;
  const company = db.prepare(`
    SELECT id, name, domain, industry, location, city, country, linkedin_url, website,
           description, employee_count, founded_year, annual_revenue, phone,
           technology_names, keywords, notes, email_domain_invalid, created_at
    FROM companies WHERE id = ?
  `).get(id) as Company | undefined;
  if (!company) return { notFound: true };
  const contacts = db.prepare(`
    SELECT id, full_name, title, email, email_status, seniority, linkedin_url, degree, connected_at
    FROM targets WHERE company_id = ? ORDER BY full_name COLLATE NOCASE
  `).all(id) as Contact[];
  return { props: { company: { ...company, contacts } } };
};


function InlineEdit({ value, onSave, render, emptyLabel, multiline = false, className = "", type = "text" }: { value: string; onSave: (val: string) => Promise<void>; render: (val: string) => React.ReactNode; emptyLabel: string; multiline?: boolean; className?: string; type?: string; }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<any>(null);

  async function handleSave() {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className={`flex items-start gap-1 ${className}`}>
        {multiline ? (
          <textarea ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Escape") setEditing(false); }} className="flex-1 w-full px-2 py-1 rounded bg-base-300 border border-primary/40 text-sm focus:outline-none focus:border-primary resize-y min-h-[80px]" />
        ) : (
          <input ref={inputRef} type={type} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }} className="flex-1 min-w-0 px-2 py-0.5 rounded bg-base-300 border border-primary/40 text-sm focus:outline-none focus:border-primary" />
        )}
        <div className="flex flex-col gap-1 shrink-0 mt-0.5">
          <button onClick={handleSave} disabled={saving} className="text-success hover:text-success/70 shrink-0"><RiCheckLine size={16} /></button>
          <button onClick={() => setEditing(false)} disabled={saving} className="text-base-content/40 hover:text-base-content/70 shrink-0"><RiCloseLine size={16} /></button>
        </div>
      </div>
    );
  }

  if (!value) {
    return (
      <button onClick={() => { setDraft(""); setEditing(true); setTimeout(() => inputRef.current?.focus(), 50); }} className="text-[11px] text-base-content/30 hover:text-base-content/60 transition-colors block">
        + Add {emptyLabel}
      </button>
    );
  }

  return (
    <div className={`group relative inline-flex items-center gap-2 ${className}`}>
      {render(value)}
      <button onClick={() => { setDraft(value); setEditing(true); setTimeout(() => inputRef.current?.focus(), 50); }} className="opacity-0 group-hover:opacity-100 text-base-content/30 hover:text-base-content/60 transition-colors shrink-0" title={`Edit ${emptyLabel}`}>
        <RiEditLine size={12} />
      </button>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] text-base-content/40 uppercase tracking-wide mb-0.5">{label}</p>
      <div className="text-sm text-base-content/80">{value}</div>
    </div>
  );
}

export default function CompanyDetailPage({ company: initialCompany }: { company: Company }) {
  const [company, setCompany] = useState(initialCompany);

  async function updateField(key: string, value: any) {
    const res = await fetch(`/api/companies/${company.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value })
    });
    if (res.ok) {
      setCompany(await res.json());
    } else {
      alert("Failed to save " + key);
    }
  }

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
        const res = await fetch(`/api/targets?search=${encodeURIComponent(searchQuery)}&limit=10`);
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
      const res = await fetch(`/api/targets/${targetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: company.id }),
      });
      if (res.ok) {
        // We do not have toast imported, let's just console.log or use standard alert if toast fails, 
        // wait, we can just fetch fresh company and we'll see it updated.
        setShowAddContact(false);
        const fresh = await fetch(`/api/companies/${company.id}`).then(r => r.json());
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
      const res = await fetch(`/api/targets/${targetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_id: null }),
      });
      if (res.ok) {
        const fresh = await fetch(`/api/companies/${company.id}`).then(r => r.json());
        setCompany(fresh);
      }
    } catch(e) {
      alert("Error unlinking");
    }
  }
  return (
    <>
      <Head>
        <title>{company.name} — Companies — Linki</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="max-w-2xl">
        {/* Back */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/companies" className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-base-content/50 hover:text-base-content hover:bg-base-300/50 transition-colors">
            <RiArrowLeftLine size={16} />
          </Link>
          <span className="text-base-content/40 text-sm">Companies</span>
        </div>

        {/* Header */}
        <div className="bg-base-200 border border-base-300/50 rounded-xl p-5 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-10 h-10 rounded-lg bg-base-300 flex items-center justify-center shrink-0 mt-0.5">
                <RiBuildingLine size={16} className="text-base-content/40" />
              </div>
              <div>
                <InlineEdit value={company.name} emptyLabel="name" onSave={v => updateField("name", v)} render={v => <h1 className="text-xl font-semibold">{v}</h1>} />
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  <InlineEdit value={company.industry || ""} emptyLabel="industry" onSave={v => updateField("industry", v)} render={v => <span className="text-sm text-base-content/50">{v}</span>} />
                  <InlineEdit value={company.location || ""} emptyLabel="location" onSave={v => updateField("location", v)} render={v => <span className="text-sm text-base-content/40 flex items-center gap-1"><RiMapPinLine size={12} /> {v}</span>} />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <InlineEdit value={company.domain || ""} emptyLabel="domain" onSave={v => updateField("domain", v)} render={v => <a href={`https://${v}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-base-300 text-base-content/60 hover:text-base-content hover:bg-base-300/80 transition-colors"><RiGlobalLine size={12} /> {v}</a>} />
                  <InlineEdit value={company.linkedin_url || ""} type="url" emptyLabel="LinkedIn URL" onSave={v => updateField("linkedin_url", v)} render={v => <a href={v} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-base-300 text-base-content/60 hover:text-base-content hover:bg-base-300/80 transition-colors"><RiLinkedinBoxLine size={12} /> LinkedIn</a>} />
                  <InlineEdit value={company.website || ""} type="url" emptyLabel="website" onSave={v => updateField("website", v)} render={v => <a href={v} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-base-300 text-base-content/60 hover:text-base-content hover:bg-base-300/80 transition-colors"><RiExternalLinkLine size={12} /> Website</a>} />
                </div>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-base-300 text-base-content/50 shrink-0">
              <RiUserLine size={11} /> {company.contacts.length} contacts
            </span>
          </div>
        </div>

        {/* Email domain invalid warning */}
        {!!company.email_domain_invalid && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-warning/10 border border-warning/20 mb-4 text-sm text-warning">
            <RiErrorWarningLine size={16} className="shrink-0 mt-0.5" />
            <span>Email domain flagged invalid — bounce detected for a contact at this company. All contacts have been unenrolled from email steps.</span>
          </div>
        )}

        {/* Description */}
        <div className="bg-base-200 border border-base-300/50 rounded-xl p-5 mb-4">
      <p className="text-[11px] text-base-content/40 uppercase tracking-wide mb-2">About</p>
      <InlineEdit value={company.description || ""} emptyLabel="description" multiline onSave={v => updateField("description", v)} render={v => <p className="text-sm text-base-content/70 leading-relaxed whitespace-pre-line">{v}</p>} />
    </div>

        {/* Details grid */}
        <div className="bg-base-200 border border-base-300/50 rounded-xl p-5 mb-4">
            <p className="text-[11px] text-base-content/40 uppercase tracking-wide mb-3">Details</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <InlineEdit value={company.employee_count?.toString() || ""} emptyLabel="employee count" onSave={v => updateField("employee_count", parseInt(v) || null)} render={v => <div className="flex items-center gap-2 text-sm text-base-content/70"><RiGroupLine size={13} className="text-base-content/30 shrink-0" /><span>{parseInt(v).toLocaleString()} employees</span></div>} />
              <InlineEdit value={company.founded_year?.toString() || ""} emptyLabel="founded year" onSave={v => updateField("founded_year", parseInt(v) || null)} render={v => <div className="flex items-center gap-2 text-sm text-base-content/70"><RiCalendarLine size={13} className="text-base-content/30 shrink-0" /><span>Founded {v}</span></div>} />
              <InlineEdit value={company.annual_revenue || ""} emptyLabel="annual revenue" onSave={v => updateField("annual_revenue", v)} render={v => <div className="flex items-center gap-2 text-sm text-base-content/70"><RiMoneyDollarCircleLine size={13} className="text-base-content/30 shrink-0" /><span>{v}</span></div>} />
              <InlineEdit value={company.phone || ""} emptyLabel="phone" onSave={v => updateField("phone", v)} render={v => <div className="flex items-center gap-2 text-sm text-base-content/70"><RiPhoneLine size={13} className="text-base-content/30 shrink-0" /><span>{v}</span></div>} />
              <InlineEdit value={company.city || ""} emptyLabel="city" onSave={v => updateField("city", v)} render={v => <div className="flex items-center gap-2 text-sm text-base-content/70"><RiMapPinLine size={13} className="text-base-content/30 shrink-0" /><span>{v}</span></div>} />
   <InlineEdit value={company.country || ""} emptyLabel="country" onSave={v => updateField("country", v)} render={v => <div className="flex items-center gap-2 text-sm text-base-content/70"><RiMapPinLine size={13} className="text-base-content/30 shrink-0" /><span>{v}</span></div>} />
            </div>

            <InlineEdit value={company.technology_names ? (() => { try { return JSON.parse(company.technology_names).join(", "); } catch { return company.technology_names; } })() : ""} emptyLabel="technologies (comma separated)" onSave={v => updateField("technology_names", JSON.stringify(v.split(",").map(s => s.trim()).filter(Boolean)))} render={v => <div className="mt-4"><div className="flex items-center gap-1.5 mb-2"><RiCodeBoxLine size={12} className="text-base-content/30" /><span className="text-[11px] text-base-content/50 uppercase tracking-wide">Technologies</span></div><div className="flex flex-wrap gap-1.5">{v.split(",").map((t: string) => <span key={t} className="px-2 py-0.5 bg-base-300 text-base-content/70 text-xs rounded-md">{t.trim()}</span>)}</div></div>} />

            <InlineEdit value={company.keywords || ""} emptyLabel="keywords (comma separated)" onSave={v => updateField("keywords", JSON.stringify(v.split(",").map((s: string) => s.trim()).filter(Boolean)))} render={(v: string) => <div className="mt-4"><div className="flex items-center gap-1.5 mb-2"><RiPriceTagLine size={12} className="text-base-content/30" /><span className="text-[11px] text-base-content/50 uppercase tracking-wide">Keywords</span></div><div className="flex flex-wrap gap-1.5">{v.split(",").map((k: string) => <span key={k} className="px-2 py-0.5 bg-base-300 text-base-content/70 text-xs rounded-md">{k.trim()}</span>)}</div></div>} />
          </div>

        {/* Notes */}
        <div className="bg-base-200 border border-base-300/50 rounded-xl p-5 mb-4">
      <p className="text-[11px] text-base-content/40 uppercase tracking-wide mb-2">Notes</p>
      <InlineEdit value={company.notes || ""} emptyLabel="notes" multiline onSave={v => updateField("notes", v)} render={v => <p className="text-sm text-base-content/70 leading-relaxed whitespace-pre-line">{v}</p>} />
    </div>

        {/* Contacts */}
        <div className="bg-base-200 border border-base-300/50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
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
          </div>
          {company.contacts.length === 0 ? (
            <p className="text-sm text-base-content/30">No contacts linked to this company.</p>
          ) : (
            <div className="flex flex-col divide-y divide-base-300/30">
              {company.contacts.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-base-300 flex items-center justify-center shrink-0">
                      <RiUserLine size={13} className="text-base-content/40" />
                    </div>
                    <div className="min-w-0">
                      <Link href={`/contacts/${c.id}`} className="text-sm font-medium hover:text-primary transition-colors truncate block">
                        {c.full_name ?? "—"}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        {c.title && <span className="text-xs text-base-content/40 truncate">{c.title}</span>}
                        {c.seniority && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-base-300 text-base-content/40 capitalize shrink-0">{c.seniority}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.email && (
                      <a href={`mailto:${c.email}`} title={c.email}
                        className={c.email_status === "invalid" ? "text-error/60 hover:text-error transition-colors" : "text-success/60 hover:text-success transition-colors"}>
                        <RiMailLine size={14} />
                      </a>
                    )}
                    {c.degree === 1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success">1st</span>
                    )}
                    {c.linkedin_url && (
                      <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-base-content/30 hover:text-base-content/60 transition-colors">
                        <RiExternalLinkLine size={13} />
                      </a>
                    )}
                    <button onClick={() => unlinkContact(c.id)} className="text-base-content/20 hover:text-error transition-colors ml-1" title="Unlink contact">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    
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
                {searchResults.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => linkContact(c.id)}
                    className="w-full flex flex-col text-left px-3 py-2 rounded-lg hover:bg-base-300/50 transition-colors"
                  >
                    <span className="text-sm font-medium text-base-content">{c.first_name} {c.last_name}</span>
                    <span className="text-xs text-base-content/40">{c.title || "No title"}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
