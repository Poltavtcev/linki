const fs = require('fs');
let code = fs.readFileSync('pages/todos/index.tsx', 'utf8');

const oldProps = `  const targets = db.prepare(\`
    SELECT id, first_name, last_name, company as company_name FROM targets ORDER BY created_at DESC LIMIT 1000
  \`).all() as TargetOption[];

  return { props: { initialTodos: todos, targets } };
};`;
const newProps = `  return { props: { initialTodos: todos } };
};`;
code = code.replace(oldProps, newProps);

const oldCompProps = `export default function TodosPage({ initialTodos, targets }: { initialTodos: Todo[], targets: TargetOption[] }) {`;
const newCompProps = `export default function TodosPage({ initialTodos }: { initialTodos: Todo[] }) {`;
code = code.replace(oldCompProps, newCompProps);

// Also remove from modal props
code = code.replace(/function GlobalTodoModal\(\{\s*targets,\s*onClose,\s*onSave,\s*initialTitle\s*=\s*"",\s*initialDescription\s*=\s*""\s*\}\:\s*\{\s*targets:\s*TargetOption\[\],\s*onClose:\s*\(\)\s*=>\s*void,\s*onSave:\s*\(t:\s*Todo\)\s*=>\s*void,\s*initialTitle\?:\s*string,\s*initialDescription\?:\s*string\s*\}\)\s*\{/g, 
  `function GlobalTodoModal({ onClose, onSave, initialTitle = "", initialDescription = "" }: { onClose: () => void, onSave: (t: Todo) => void, initialTitle?: string, initialDescription?: string }) {`);

code = code.replace(/function GlobalTodoDetailModal\(\{\s*todo,\s*targets,\s*onClose,\s*onSave,\s*onDelete,\s*onDuplicate\s*\}\:\s*\{\s*todo:\s*Todo,\s*targets:\s*TargetOption\[\],\s*onClose:\s*\(\)\s*=>\s*void,\s*onSave:\s*\(t:\s*Todo\)\s*=>\s*void,\s*onDelete:\s*\(id:\s*string\)\s*=>\s*void,\s*onDuplicate\?:\s*\(todo:\s*Todo\)\s*=>\s*void\s*\}\)\s*\{/g,
  `function GlobalTodoDetailModal({ todo, onClose, onSave, onDelete, onDuplicate }: { todo: Todo, onClose: () => void, onSave: (t: Todo) => void, onDelete: (id: string) => void, onDuplicate?: (todo: Todo) => void }) {`);

code = code.replace(/<GlobalTodoModal[\s\S]*?targets=\{targets\}[\s\S]*?initialTitle=/g, `<GlobalTodoModal\n          initialTitle=`);
code = code.replace(/<GlobalTodoDetailModal targets=\{targets\}\s*todo=\{selectedTodo\}/g, `<GlobalTodoDetailModal\n          todo={selectedTodo}`);

fs.writeFileSync('pages/todos/index.tsx', code);
