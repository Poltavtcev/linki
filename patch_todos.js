const fs = require('fs');
let code = fs.readFileSync('pages/todos/index.tsx', 'utf8');

// 1. Update GlobalTodoModal props and state init
const oldModalProps = `function GlobalTodoModal({ targets, onClose, onSave }: { targets: TargetOption[], onClose: () => void, onSave: (t: Todo) => void }) {
  const [targetId, setTargetId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");`;
const newModalProps = `function GlobalTodoModal({ targets, onClose, onSave, initialTitle = "", initialDescription = "" }: { targets: TargetOption[], onClose: () => void, onSave: (t: Todo) => void, initialTitle?: string, initialDescription?: string }) {
  const [targetId, setTargetId] = useState("");
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);`;
code = code.replace(oldModalProps, newModalProps);

// 2. Update GlobalTodoDetailModal props to include onDuplicate
const oldDetailProps = `function GlobalTodoDetailModal({ todo, targets, onClose, onSave, onDelete }: { todo: Todo, targets: TargetOption[], onClose: () => void, onSave: (t: Todo) => void, onDelete: (id: string) => void }) {`;
const newDetailProps = `function GlobalTodoDetailModal({ todo, targets, onClose, onSave, onDelete, onDuplicate }: { todo: Todo, targets: TargetOption[], onClose: () => void, onSave: (t: Todo) => void, onDelete: (id: string) => void, onDuplicate?: (todo: Todo) => void }) {`;
code = code.replace(oldDetailProps, newDetailProps);

// 3. Add Duplicate button in GlobalTodoDetailModal
const oldButtons = `<div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-base-300/40">
          <button onClick={del} className="px-4 py-2 rounded-xl text-sm text-error/80 hover:text-error hover:bg-error/10 transition-colors">Delete</button>
          <div className="flex gap-2">`;
const newButtons = `<div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-base-300/40">
          <div className="flex gap-2">
            <button onClick={del} className="px-4 py-2 rounded-xl text-sm text-error/80 hover:text-error hover:bg-error/10 transition-colors">Delete</button>
            {onDuplicate && (
              <button onClick={() => onDuplicate(todo)} className="px-4 py-2 rounded-xl text-sm text-base-content/60 hover:text-base-content hover:bg-base-300/50 transition-colors">Duplicate</button>
            )}
          </div>
          <div className="flex gap-2">`;
code = code.replace(oldButtons, newButtons);

// 4. Update TodosPage state
const oldPageState = `const [showModal, setShowModal] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);`;
const newPageState = `const [showModal, setShowModal] = useState(false);
  const [modalDefaults, setModalDefaults] = useState({ title: "", description: "" });
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);`;
code = code.replace(oldPageState, newPageState);

// 5. Update how GlobalTodoModal is rendered in TodosPage
const oldRenderModal = `{showModal && (
        <GlobalTodoModal
          targets={targets}
          onClose={() => setShowModal(false)}
          onSave={(t) => {
            setTodos([t, ...todos]);
            setShowModal(false);
          }}
        />
      )}`;
const newRenderModal = `{showModal && (
        <GlobalTodoModal
          targets={targets}
          initialTitle={modalDefaults.title}
          initialDescription={modalDefaults.description}
          onClose={() => setShowModal(false)}
          onSave={(t) => {
            setTodos([t, ...todos]);
            setShowModal(false);
          }}
        />
      )}`;
code = code.replace(oldRenderModal, newRenderModal);

// 6. Update how GlobalTodoDetailModal is rendered in TodosPage
const oldRenderDetail = `<GlobalTodoDetailModal
          todo={selectedTodo}
          targets={targets}
          onClose={() => setSelectedTodo(null)}
          onSave={(t) => {
            setTodos(todos.map(x => x.id === t.id ? t : x));
            setSelectedTodo(null);
          }}
          onDelete={(id) => {
            setTodos(todos.filter(x => x.id !== id));
            setSelectedTodo(null);
          }}
        />`;
const newRenderDetail = `<GlobalTodoDetailModal
          todo={selectedTodo}
          targets={targets}
          onClose={() => setSelectedTodo(null)}
          onSave={(t) => {
            setTodos(todos.map(x => x.id === t.id ? t : x));
            setSelectedTodo(null);
          }}
          onDelete={(id) => {
            setTodos(todos.filter(x => x.id !== id));
            setSelectedTodo(null);
          }}
          onDuplicate={(t) => {
            setSelectedTodo(null);
            setModalDefaults({ title: t.title, description: t.description || "" });
            setShowModal(true);
          }}
        />`;
code = code.replace(oldRenderDetail, newRenderDetail);

// 7. Update "Add task" button to clear defaults
const oldAddTask = `onClick={() => setShowModal(true)}`;
const newAddTask = `onClick={() => { setModalDefaults({ title: "", description: "" }); setShowModal(true); }}`;
code = code.replace(oldAddTask, newAddTask);

fs.writeFileSync('pages/todos/index.tsx', code);
