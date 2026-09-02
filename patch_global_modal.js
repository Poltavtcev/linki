const fs = require('fs');
let code = fs.readFileSync('pages/todos/index.tsx', 'utf8');

const oldModal = `<GlobalTodoModal
          targets={targets}
          onClose={() => setShowModal(false)}`;
const newModal = `<GlobalTodoModal
          targets={targets}
          initialTitle={modalDefaults.title}
          initialDescription={modalDefaults.description}
          onClose={() => setShowModal(false)}`;
code = code.replace(oldModal, newModal);
fs.writeFileSync('pages/todos/index.tsx', code);
