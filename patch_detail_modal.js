const fs = require('fs');
let code = fs.readFileSync('pages/todos/index.tsx', 'utf8');

const oldDetail = `<GlobalTodoDetailModal targets={targets}
          todo={selectedTodo}
          onClose={() => setSelectedTodo(null)}
          onSave={(updated) => {
            setTodos(prev => prev.map(t => t.id === updated.id ? updated : t));
            setSelectedTodo(null);
          }}
          onDelete={(id) => {
            setTodos(prev => prev.filter(t => t.id !== id));
            setSelectedTodo(null);
          }}
        />`;

const newDetail = `<GlobalTodoDetailModal targets={targets}
          todo={selectedTodo}
          onClose={() => setSelectedTodo(null)}
          onSave={(updated) => {
            setTodos(prev => prev.map(t => t.id === updated.id ? updated : t));
            setSelectedTodo(null);
          }}
          onDelete={(id) => {
            setTodos(prev => prev.filter(t => t.id !== id));
            setSelectedTodo(null);
          }}
          onDuplicate={(t) => {
            setSelectedTodo(null);
            setModalDefaults({ title: t.title, description: t.description || "" });
            setShowModal(true);
          }}
        />`;

code = code.replace(oldDetail, newDetail);
fs.writeFileSync('pages/todos/index.tsx', code);
