const fs = require('fs');
let code = fs.readFileSync('pages/todos/index.tsx', 'utf8');

// 1. Add import for ContactSelect
code = code.replace(/import \{ toast \} from "sonner";/, 'import { toast } from "sonner";\nimport ContactSelect from "@/components/ui/ContactSelect";');

// 2. Patch GlobalTodoModal
const targetSelect1 = `<div className="relative">
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30 pointer-events-none" height="13" width="13" xmlns="http://www.w3.org/2000/svg"><path d="M4 22C4 17.5817 7.58172 14 12 14C16.4183 14 20 17.5817 20 22H18C18 18.6863 15.3137 16 12 16C8.68629 16 6 18.6863 6 22H4ZM12 13C8.685 13 6 10.315 6 7C6 3.685 8.685 1 12 1C15.315 1 18 3.685 18 7C18 10.315 15.315 13 12 13ZM12 11C14.21 11 16 9.21 16 7C16 4.79 14.21 3 12 3C9.79 3 8 4.79 8 7C8 9.21 9.79 11 12 11Z"></path></svg>
                <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full pl-8 pr-3 py-2 bg-base-200/60 border border-base-300/40 rounded-xl text-sm text-base-content/80 focus:outline-none focus:border-base-300/80 appearance-none transition-colors">
                  <option value="" disabled>Select contact...</option>
                  {targets.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.first_name} {t.last_name} {t.company_name ? \`(\${t.company_name})\` : ""}
                    </option>
                  ))}
                </select>
              </div>`;
const newSelect1 = `<ContactSelect value={targetId} onChange={setTargetId} />`;
code = code.replace(targetSelect1, newSelect1);

// 3. Patch GlobalTodoDetailModal
const targetSelect2 = `<div className="relative">
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30 pointer-events-none" height="13" width="13" xmlns="http://www.w3.org/2000/svg"><path d="M4 22C4 17.5817 7.58172 14 12 14C16.4183 14 20 17.5817 20 22H18C18 18.6863 15.3137 16 12 16C8.68629 16 6 18.6863 6 22H4ZM12 13C8.685 13 6 10.315 6 7C6 3.685 8.685 1 12 1C15.315 1 18 3.685 18 7C18 10.315 15.315 13 12 13ZM12 11C14.21 11 16 9.21 16 7C16 4.79 14.21 3 12 3C9.79 3 8 4.79 8 7C8 9.21 9.79 11 12 11Z"></path></svg>
                <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full pl-8 pr-3 py-2 bg-base-200/60 border border-base-300/40 rounded-xl text-sm text-base-content/80 focus:outline-none focus:border-base-300/80 appearance-none transition-colors">
                  <option value="" disabled>Select contact...</option>
                  {targets.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.first_name} {t.last_name} {t.company_name ? \`(\${t.company_name})\` : ""}
                    </option>
                  ))}
                </select>
              </div>`;
const newSelect2 = `<ContactSelect value={targetId} onChange={setTargetId} initialTarget={{ id: todo.target_id, first_name: todo.first_name || "", last_name: todo.last_name || "", company: todo.company_name || "" }} />`;
code = code.replace(targetSelect2, newSelect2);

fs.writeFileSync('pages/todos/index.tsx', code);
