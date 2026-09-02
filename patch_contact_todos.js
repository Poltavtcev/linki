const fs = require('fs');
let code = fs.readFileSync('pages/contacts/[id].tsx', 'utf8');

// 1. Update TodoModal
const oldTodoModal = `function TodoModal({ targetId, onClose, onSave }: {
  targetId: string;
  onClose: () => void;
  onSave: (todo: Todo) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");`;
const newTodoModal = `function TodoModal({ targetId, onClose, onSave, initialTitle = "", initialDescription = "" }: {
  targetId: string;
  onClose: () => void;
  onSave: (todo: Todo) => void;
  initialTitle?: string;
  initialDescription?: string;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);`;
code = code.replace(oldTodoModal, newTodoModal);

// 2. Update TodoDetailModal props
const oldDetailModal = `function TodoDetailModal({ todo, onClose, onSave }: {
  todo: Todo;
  onClose: () => void;
  onSave: (updated: Todo) => void;
}) {`;
const newDetailModal = `function TodoDetailModal({ todo, onClose, onSave, onDuplicate }: {
  todo: Todo;
  onClose: () => void;
  onSave: (updated: Todo) => void;
  onDuplicate?: (todo: Todo) => void;
}) {`;
code = code.replace(oldDetailModal, newDetailModal);

// 3. Add Duplicate button
const oldButtons = `<div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-base-content/50 hover:text-base-content hover:bg-base-300/40 transition-colors">Cancel</button>`;
const newButtons = `<div className="flex gap-2">
            {onDuplicate && (
              <button onClick={() => onDuplicate(todo)} className="px-4 py-2 rounded-xl text-sm text-base-content/60 hover:text-base-content hover:bg-base-300/50 transition-colors">Duplicate</button>
            )}
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-base-content/50 hover:text-base-content hover:bg-base-300/40 transition-colors">Cancel</button>`;
code = code.replace(oldButtons, newButtons);

// 4. Update parent state
const oldState = `const [showTodoModal, setShowTodoModal] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);`;
const newState = `const [showTodoModal, setShowTodoModal] = useState(false);
  const [todoDefaults, setTodoDefaults] = useState({ title: "", description: "" });
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);`;
code = code.replace(oldState, newState);

// 5. Update parent render for TodoModal
const oldRender = `<TodoModal
          targetId={target.id}
          onClose={() => setShowTodoModal(false)}
          onSave={(todo) => { setTodos((prev) => [todo, ...prev]); setShowTodoModal(false); toast.success("Todo created"); }}`;
const newRender = `<TodoModal
          targetId={target.id}
          initialTitle={todoDefaults.title}
          initialDescription={todoDefaults.description}
          onClose={() => setShowTodoModal(false)}
          onSave={(todo) => { setTodos((prev) => [todo, ...prev]); setShowTodoModal(false); toast.success("Todo created"); }}`;
code = code.replace(oldRender, newRender);

// 6. Update parent render for TodoDetailModal
const oldRenderDetail = `<TodoDetailModal
          todo={selectedTodo}
          onClose={() => setSelectedTodo(null)}
          onSave={(updated) => { setTodos((prev) => prev.map((t) => t.id === updated.id ? updated : t)); setSelectedTodo(null); toast.success("Saved"); }}`;
const newRenderDetail = `<TodoDetailModal
          todo={selectedTodo}
          onClose={() => setSelectedTodo(null)}
          onSave={(updated) => { setTodos((prev) => prev.map((t) => t.id === updated.id ? updated : t)); setSelectedTodo(null); toast.success("Saved"); }}
          onDuplicate={(t) => { setSelectedTodo(null); setTodoDefaults({ title: t.title, description: t.description || "" }); setShowTodoModal(true); }}`;
code = code.replace(oldRenderDetail, newRenderDetail);

// 7. Clear defaults on normal add
code = code.replace(/onClick=\{\(\) => setShowTodoModal\(true\)\}/g, `onClick={() => { setTodoDefaults({ title: "", description: "" }); setShowTodoModal(true); }}`);

fs.writeFileSync('pages/contacts/[id].tsx', code);
