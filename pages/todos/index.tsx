import { GetServerSideProps } from "next";
import { useState, useRef, useEffect, useMemo } from "react";
import Head from "next/head";
import Sidebar from "@/components/layout/Sidebar";
import { getDb } from "@/lib/db";
import { RiCloseLine, RiCheckboxBlankCircleLine, RiCheckboxCircleFill, RiAddLine, RiSearchLine, RiBuildingLine, RiCalendarLine } from "react-icons/ri";
import { toast } from "sonner";
import ContactSelect from "@/components/ui/ContactSelect";

interface Todo {
  id: string;
  target_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: "open" | "done";
  created_at: string;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
}

interface TargetOption {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const db = getDb();
  const todos = db.prepare(`
    SELECT todos.*, targets.first_name, targets.last_name, targets.company as company_name 
    FROM todos 
    JOIN targets ON todos.target_id = targets.id 
    ORDER BY todos.status ASC, todos.due_date ASC, todos.created_at DESC
  `).all() as Todo[];

  return { props: { initialTodos: todos } };
};

function GlobalTodoModal({ onClose, onSave, initialTitle = "", initialDescription = "" }: { onClose: () => void, onSave: (t: Todo) => void, initialTitle?: string, initialDescription?: string }) {
  const [targetId, setTargetId] = useState("");
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!title.trim() || !targetId) return;
    setSaving(true);
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_id: targetId, title: title.trim(), description: description.trim() || undefined, due_date: dueDate || undefined }),
    });
    setSaving(false);
    if (!res.ok) { toast.error("Failed to create"); return; }
    onSave(await res.json() as Todo);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-base-100 border border-base-300/60 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-base-300/40">
          <h2 className="text-sm font-semibold text-base-content">New todo</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-base-content/40 hover:text-base-content hover:bg-base-300/50 transition-colors">
            <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M11.9997 10.5865L16.9495 5.63672L18.3637 7.05093L13.4139 12.0007L18.3637 16.9504L16.9495 18.3646L11.9997 13.4149L7.04996 18.3646L5.63574 16.9504L10.5855 12.0007L5.63574 7.05093L7.04996 5.63672L11.9997 10.5865Z"></path></svg>
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-5">
          <div>
            <input ref={titleRef} placeholder="Task title" className="w-full bg-transparent text-base font-medium text-base-content placeholder-base-content/25 focus:outline-none" type="text" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
          </div>
          <div>
            <textarea placeholder="Add a description..." rows={4} className="w-full bg-base-200/60 border border-base-300/40 rounded-xl px-4 py-3 text-sm text-base-content/80 placeholder-base-content/25 leading-relaxed focus:outline-none focus:border-base-300/80 resize-none transition-colors" value={description} onChange={e => setDescription(e.target.value)}></textarea>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-base-content/40 uppercase tracking-wide mb-1.5">Contact</label>
              <ContactSelect value={targetId} onChange={setTargetId} />
            </div>
            <div>
              <label className="block text-[11px] text-base-content/40 uppercase tracking-wide mb-1.5">Due date</label>
              <div className="relative">
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30 pointer-events-none" height="13" width="13" xmlns="http://www.w3.org/2000/svg"><path d="M9 1V3H15V1H17V3H21C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H7V1H9ZM20 11H4V19H20V11ZM7 5H4V9H20V5H17V7H15V5H9V7H7V5Z"></path></svg>
                <input value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full pl-8 pr-3 py-2 bg-base-200/60 border border-base-300/40 rounded-xl text-sm text-base-content/80 focus:outline-none focus:border-base-300/80 transition-colors" type="date" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-base-300/40">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-base-content/50 hover:text-base-content hover:bg-base-300/40 transition-colors">Cancel</button>
          <button onClick={save} disabled={saving || !title.trim() || !targetId} className="px-4 py-2 rounded-xl text-sm font-medium bg-primary/90 text-primary-content hover:bg-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors">{saving ? "Saving..." : "Create todo"}</button>
        </div>
      </div>
    </div>
  );
}

function GlobalTodoDetailModal({ todo, onClose, onSave, onDelete, onDuplicate }: { todo: Todo, onClose: () => void, onSave: (t: Todo) => void, onDelete: (id: string) => void, onDuplicate?: (todo: Todo) => void }) {
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description ?? "");
  const [dueDate, setDueDate] = useState(todo.due_date ?? "");
  const [targetId, setTargetId] = useState(todo.target_id);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!title.trim() || !targetId) return;
    setSaving(true);
    const res = await fetch(`/api/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_id: targetId, title: title.trim(), description: description.trim() || null, due_date: dueDate || null }),
    });
    setSaving(false);
    if (!res.ok) { toast.error("Failed to save"); return; }
    onSave(await res.json() as Todo);
  }

  async function del() {
    if (!window.confirm("Delete this todo?")) return;
    const res = await fetch(`/api/todos/${todo.id}`, { method: "DELETE" });
    if (!res.ok) toast.error("Failed to delete");
    else onDelete(todo.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-base-100 border border-base-300/60 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-base-300/40">
          <h2 className="text-sm font-semibold text-base-content">Edit todo</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-base-content/40 hover:text-base-content hover:bg-base-300/50 transition-colors">
            <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="16" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M11.9997 10.5865L16.9495 5.63672L18.3637 7.05093L13.4139 12.0007L18.3637 16.9504L16.9495 18.3646L11.9997 13.4149L7.04996 18.3646L5.63574 16.9504L10.5855 12.0007L5.63574 7.05093L7.04996 5.63672L11.9997 10.5865Z"></path></svg>
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-5">
          <div>
            <input ref={titleRef} placeholder="Task title" className="w-full bg-transparent text-base font-medium text-base-content placeholder-base-content/25 focus:outline-none" type="text" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
          </div>
          <div>
            <textarea placeholder="Add a description..." rows={4} className="w-full bg-base-200/60 border border-base-300/40 rounded-xl px-4 py-3 text-sm text-base-content/80 placeholder-base-content/25 leading-relaxed focus:outline-none focus:border-base-300/80 resize-none transition-colors" value={description} onChange={e => setDescription(e.target.value)}></textarea>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-base-content/40 uppercase tracking-wide mb-1.5">Contact</label>
              <ContactSelect value={targetId} onChange={setTargetId} initialTarget={{ id: todo.target_id, first_name: todo.first_name || "", last_name: todo.last_name || "", company: todo.company_name || "" }} />
            </div>
            <div>
              <label className="block text-[11px] text-base-content/40 uppercase tracking-wide mb-1.5">Due date</label>
              <div className="relative">
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30 pointer-events-none" height="13" width="13" xmlns="http://www.w3.org/2000/svg"><path d="M9 1V3H15V1H17V3H21C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H7V1H9ZM20 11H4V19H20V11ZM7 5H4V9H20V5H17V7H15V5H9V7H7V5Z"></path></svg>
                <input value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full pl-8 pr-3 py-2 bg-base-200/60 border border-base-300/40 rounded-xl text-sm text-base-content/80 focus:outline-none focus:border-base-300/80 transition-colors" type="date" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-base-300/40">
          <div className="flex gap-2">
            <button onClick={del} className="px-4 py-2 rounded-xl text-sm text-error/80 hover:text-error hover:bg-error/10 transition-colors">Delete</button>
            {onDuplicate && (
              <button onClick={() => onDuplicate(todo)} className="px-4 py-2 rounded-xl text-sm text-base-content/60 hover:text-base-content hover:bg-base-300/50 transition-colors">Duplicate</button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-base-content/50 hover:text-base-content hover:bg-base-300/40 transition-colors">Cancel</button>
            <button onClick={save} disabled={saving || !title.trim() || !targetId} className="px-4 py-2 rounded-xl text-sm font-medium bg-primary/90 text-primary-content hover:bg-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors">{saving ? "Saving..." : "Save changes"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TodosPage({ initialTodos }: { initialTodos: Todo[] }) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [filter, setFilter] = useState<"all" | "open" | "done">("open");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalDefaults, setModalDefaults] = useState({ title: "", description: "" });
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);

  const openCount = todos.filter(t => t.status === "open").length;

  const filteredTodos = useMemo(() => {
    return todos.filter(t => {
      if (filter === "open" && t.status !== "open") return false;
      if (filter === "done" && t.status !== "done") return false;
      if (search) {
        const q = search.toLowerCase();
        const contactName = `${t.first_name || ""} ${t.last_name || ""}`.toLowerCase();
        const companyName = (t.company_name || "").toLowerCase();
        const title = t.title.toLowerCase();
        if (!title.includes(q) && !contactName.includes(q) && !companyName.includes(q)) return false;
      }
      return true;
    });
  }, [todos, filter, search]);

  const PAGE_SIZE = 25;
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [filter, search]);

  const paginatedTodos = filteredTodos.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredTodos.length / PAGE_SIZE);

  async function toggleTodo(todo: Todo) {
    const next = todo.status === "open" ? "done" : "open";
    const res = await fetch(`/api/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) { toast.error("Failed to update status"); return; }
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, status: next } : t));
  }

  return (
    <>
      <Head>
        <title>Todos — Linki</title>
      </Head>
      <div className="flex min-h-screen bg-base-100 text-base-content antialiased">
        <Sidebar />
        <main className="ml-13 flex-1 p-6 overflow-y-auto transition-[margin] duration-200">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-start justify-between mb-7">
              <div>
                <h1 className="text-base font-semibold text-base-content tracking-tight">Todos</h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-base-content/40">{openCount} open</span>
                </div>
              </div>
              <button
                onClick={() => { setModalDefaults({ title: "", description: "" }); setShowModal(true); }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-base-200 border border-base-300/50 text-base-content/70 hover:text-base-content hover:bg-base-300/60 transition-colors"
              >
                <RiAddLine size={14} />
                New todo
              </button>
            </div>

            <div className="flex items-center gap-3 mb-5">
              <div className="flex gap-0.5 bg-base-200 border border-base-300/40 rounded-xl p-1">
                <button
                  onClick={() => setFilter("open")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${filter === "open" ? "bg-base-300 text-base-content shadow-sm" : "text-base-content/40 hover:text-base-content/70"}`}
                >
                  Open
                </button>
                <button
                  onClick={() => setFilter("all")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${filter === "all" ? "bg-base-300 text-base-content shadow-sm" : "text-base-content/40 hover:text-base-content/70"}`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter("done")}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${filter === "done" ? "bg-base-300 text-base-content shadow-sm" : "text-base-content/40 hover:text-base-content/70"}`}
                >
                  Done
                </button>
              </div>
              <input
                  placeholder="Filter by contact or company..."
                  className="flex-1 px-3 py-2 bg-base-200 border border-base-300/40 rounded-xl text-xs text-base-content/80 placeholder-base-content/30 focus:outline-none focus:border-base-300/70 transition-colors"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="flex flex-col divide-y divide-base-300/30">
              {filteredTodos.length === 0 ? (
                <div className="text-center py-20">
                  <div className="text-base-content/20 text-sm mb-2">No todos</div>
                  <button onClick={() => setShowModal(true)} className="text-xs text-base-content/30 hover:text-primary transition-colors">+ Create one</button>
                </div>
              ) : (
                filteredTodos.map(todo => {
                  const isDone = todo.status === "done";
                  const isOverdue = !isDone && todo.due_date && new Date(todo.due_date) < new Date(new Date().toDateString());
                  
                  return (
                    <div key={todo.id} className={`group flex items-start gap-3 py-3.5 px-2 transition-colors hover:bg-base-200/40 rounded-lg -mx-2 ${isDone ? "opacity-60" : ""}`}>
                      <button
                        onClick={() => toggleTodo(todo)}
                        className={`mt-0.5 shrink-0 transition-colors ${isDone ? "text-success" : "text-base-content/20 hover:text-base-content/60"}`}
                      >
                        {isDone ? <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="17" width="17" xmlns="http://www.w3.org/2000/svg"><path d="M4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12ZM12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM17.4571 9.45711L16.0429 8.04289L11 13.0858L8.20711 10.2929L6.79289 11.7071L11 15.9142L17.4571 9.45711Z"></path></svg> : <RiCheckboxBlankCircleLine size={17} />}
                      </button>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedTodo(todo)}>
                        <p className={`text-sm leading-snug ${isDone ? "line-through text-base-content/40" : "text-base-content"}`}>
                          {todo.title}
                        </p>
                        {todo.description && (
                          <p className="text-xs text-base-content/40 mt-1 leading-relaxed line-clamp-2">
                            {todo.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <a href={`/contacts/${todo.target_id}`} className="inline-flex items-center gap-1 text-xs text-base-content/40 hover:text-primary transition-colors" onClick={e => e.stopPropagation()}>
                            <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="11" width="11" xmlns="http://www.w3.org/2000/svg"><path d="M4 22C4 17.5817 7.58172 14 12 14C16.4183 14 20 17.5817 20 22H18C18 18.6863 15.3137 16 12 16C8.68629 16 6 18.6863 6 22H4ZM12 13C8.685 13 6 10.315 6 7C6 3.685 8.685 1 12 1C15.315 1 18 3.685 18 7C18 10.315 15.315 13 12 13ZM12 11C14.21 11 16 9.21 16 7C16 4.79 14.21 3 12 3C9.79 3 8 4.79 8 7C8 9.21 9.79 11 12 11Z"></path></svg>
                            {todo.first_name || ""} {todo.last_name || ""}
                          </a>
                          {todo.due_date && (
                            <span className={`inline-flex items-center gap-1 text-xs ${isOverdue ? "text-error" : "text-base-content/40"}`}>
                              <RiCalendarLine size={11} />
                              {new Date(todo.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setModalDefaults({ title: todo.title, description: todo.description || "" }); 
                            setShowModal(true); 
                          }} 
                          className="opacity-0 group-hover:opacity-100 text-base-content/25 hover:text-base-content/70 transition-all"
                          title="Duplicate task"
                        >
                          <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="14" width="14" xmlns="http://www.w3.org/2000/svg"><path d="M7 6V3C7 2.44772 7.44772 2 8 2H20C20.5523 2 21 2.44772 21 3V17C21 17.5523 20.5523 18 20 18H17V21C17 21.5523 16.5523 22 16 22H4C3.44772 22 3 21.5523 3 21V7C3 6.44772 3.44772 6 4 6H7ZM5 8V20H15V8H5ZM9 4V6H17V16H19V4H9Z"></path></svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            fetch(`/api/todos/${todo.id}`, { method: "DELETE" })
                                .then(() => {
                                  setTodos(prev => prev.filter(t => t.id !== todo.id));
                                  toast.success("Todo deleted");
                                });
                          }}
                          className="opacity-0 group-hover:opacity-100 text-base-content/25 hover:text-error/70 transition-all"
                        >
                          <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="14" width="14" xmlns="http://www.w3.org/2000/svg"><path d="M17 6H22V8H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V8H2V6H7V3C7 2.44772 7.44772 2 8 2H16C16.5523 2 17 2.44772 17 3V6ZM18 8H6V20H18V8ZM9 11H11V17H9V11ZM13 11H15V17H13V11ZM9 4V6H15V4H9Z"></path></svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </main>
      </div>

      {showModal && (
        <GlobalTodoModal
          initialTitle={modalDefaults.title}
          initialDescription={modalDefaults.description}
          onClose={() => setShowModal(false)}
          onSave={(todo) => {
            setTodos(prev => [todo, ...prev]);
            setShowModal(false);
            toast.success("Todo created");
          }}
        />
      )}

      {selectedTodo && (
        <GlobalTodoDetailModal
          todo={selectedTodo}
          onClose={() => setSelectedTodo(null)}
          onSave={(updated) => {
            setTodos(prev => prev.map(t => t.id === updated.id ? updated : t));
            setSelectedTodo(null);
            toast.success("Saved");
          }}
          onDelete={(id) => {
            setTodos(prev => prev.filter(t => t.id !== id));
            setSelectedTodo(null);
          }}
        />
      )}
    </>
  );
}
