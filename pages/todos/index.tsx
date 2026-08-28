import { GetServerSideProps } from "next";
import { useState, useRef, useEffect, useMemo } from "react";
import Head from "next/head";
import Sidebar from "@/components/layout/Sidebar";
import { getDb } from "@/lib/db";
import { RiCloseLine, RiCheckboxBlankCircleLine, RiCheckboxCircleFill, RiAddLine, RiSearchLine, RiBuildingLine, RiCalendarLine } from "react-icons/ri";
import { toast } from "sonner";

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

  const targets = db.prepare(`
    SELECT id, first_name, last_name, company as company_name FROM targets ORDER BY created_at DESC LIMIT 1000
  `).all() as TargetOption[];

  return { props: { initialTodos: todos, targets } };
};

function GlobalTodoModal({ targets, onClose, onSave }: { targets: TargetOption[], onClose: () => void, onSave: (t: Todo) => void }) {
  const [targetId, setTargetId] = useState(targets[0]?.id || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
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
            <RiCloseLine size={16} />
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <select 
            value={targetId} 
            onChange={e => setTargetId(e.target.value)}
            className="w-full bg-base-200 border border-base-300/40 text-sm font-medium text-base-content focus:outline-none rounded-xl p-2.5"
          >
            <option value="" disabled>Select contact...</option>
            {targets.map(t => (
              <option key={t.id} value={t.id}>
                {t.first_name} {t.last_name} {t.company_name ? `(${t.company_name})` : ""}
              </option>
            ))}
          </select>

          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            placeholder="Task title"
            className="w-full bg-transparent text-base font-medium text-base-content placeholder-base-content/25 focus:outline-none border-b border-base-300/30 pb-3"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details... (optional)"
            className="w-full bg-transparent text-sm text-base-content/70 placeholder-base-content/25 focus:outline-none resize-none min-h-[80px]"
          />
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="px-3 py-1.5 bg-base-200 text-base-content/70 text-xs font-medium rounded-lg border border-base-300/50 focus:outline-none"
            />
          </div>
        </div>
        <div className="px-6 py-4 bg-base-200/50 border-t border-base-300/40 flex justify-end">
          <button
            onClick={save}
            disabled={saving || !title.trim() || !targetId}
            className="px-4 py-2 bg-base-content text-base-100 text-sm font-medium rounded-xl hover:bg-base-content/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create todo"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GlobalTodoDetailModal({ todo, onClose, onSave, onDelete }: { todo: Todo, onClose: () => void, onSave: (t: Todo) => void, onDelete: (id: string) => void }) {
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description ?? "");
  const [dueDate, setDueDate] = useState(todo.due_date ?? "");
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), description: description.trim() || null, due_date: dueDate || null }),
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
            <RiCloseLine size={16} />
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); }}
            placeholder="Task title"
            className="w-full bg-transparent text-base font-medium text-base-content placeholder-base-content/25 focus:outline-none border-b border-base-300/30 pb-3"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details... (optional)"
            className="w-full bg-transparent text-sm text-base-content/70 placeholder-base-content/25 focus:outline-none resize-none min-h-[80px]"
          />
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="px-3 py-1.5 bg-base-200 text-base-content/70 text-xs font-medium rounded-lg border border-base-300/50 focus:outline-none"
            />
          </div>
        </div>
        <div className="px-6 py-4 bg-base-200/50 border-t border-base-300/40 flex justify-between">
          <button
            onClick={del}
            className="px-4 py-2 bg-error/10 text-error text-sm font-medium rounded-xl hover:bg-error/20 transition-colors"
          >
            Delete
          </button>
          <button
            onClick={save}
            disabled={saving || !title.trim()}
            className="px-4 py-2 bg-base-content text-base-100 text-sm font-medium rounded-xl hover:bg-base-content/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TodosPage({ initialTodos, targets }: { initialTodos: Todo[], targets: TargetOption[] }) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [filter, setFilter] = useState<"all" | "open" | "done">("open");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
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
                onClick={() => setShowModal(true)}
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
              <div className="flex-1 relative">
                <input
                  placeholder="Filter by title, contact or company..."
                  className="w-full px-3 py-2 pl-9 bg-base-200 border border-base-300/40 rounded-xl text-xs text-base-content/80 placeholder-base-content/30 focus:outline-none focus:border-base-300/70 transition-colors"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" size={14} />
              </div>
            </div>

            <div className="flex flex-col divide-y divide-base-300/30">
              {filteredTodos.length === 0 ? (
                <div className="py-12 text-center text-base-content/40 text-sm">
                  No todos found.
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
                        {isDone ? <RiCheckboxCircleFill size={17} /> : <RiCheckboxBlankCircleLine size={17} />}
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
                            <RiBuildingLine size={11} />
                            {todo.first_name} {todo.last_name} {todo.company_name ? `(${todo.company_name})` : ""}
                          </a>
                          {todo.due_date && (
                            <span className={`inline-flex items-center gap-1 text-xs ${isOverdue ? "text-error" : "text-base-content/40"}`}>
                              <RiCalendarLine size={11} />
                              {new Date(todo.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </div>
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
          targets={targets}
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
