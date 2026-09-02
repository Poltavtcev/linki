const fs = require('fs');

function patchIndex() {
  let code = fs.readFileSync('pages/todos/index.tsx', 'utf8');
  
  // Remove the text Copy button
  const oldCopyBtn = `                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center pr-2 mt-0.5">
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setModalDefaults({ title: todo.title, description: todo.description || "" }); 
                            setShowModal(true); 
                          }} 
                          className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-base-300/60 hover:bg-base-300 rounded text-base-content/40 hover:text-base-content transition-colors"
                          title="Duplicate task"
                        >
                          Copy
                        </button>
                      </div>`;
  code = code.replace(oldCopyBtn, "");
  
  // Add icon Copy button next to Delete
  const targetDel = `<div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();`;
  const newDel = `<div className="flex items-center gap-3 shrink-0">
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
                            e.stopPropagation();`;
  code = code.replace(targetDel, newDel);
  
  fs.writeFileSync('pages/todos/index.tsx', code);
}

function patchContact() {
  let code = fs.readFileSync('pages/contacts/[id].tsx', 'utf8');
  
  // Remove the text Copy button
  const oldCopyBtn = `                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center pr-2 mt-0.5">
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setTodoDefaults({ title: todo.title, description: todo.description || "" }); 
                            setShowTodoModal(true); 
                          }} 
                          className="text-[9px] uppercase font-bold tracking-wider px-2 py-1 bg-base-300/60 hover:bg-base-300 rounded text-base-content/40 hover:text-base-content transition-colors"
                          title="Duplicate task"
                        >
                          Copy
                        </button>
                      </div>`;
  code = code.replace(oldCopyBtn, "");
  
  // Add icon Copy button next to Delete
  const targetDel = `<button
                      onClick={() => deleteTodo(todo.id)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 text-base-content/20 hover:text-error/60 transition-all"
                    >
                      <RiDeleteBinLine size={12} />
                    </button>`;
  
  const newDel = `<button
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setTodoDefaults({ title: todo.title, description: todo.description || "" }); 
                        setShowTodoModal(true); 
                      }} 
                      className="shrink-0 opacity-0 group-hover:opacity-100 text-base-content/20 hover:text-base-content/60 transition-all"
                      title="Duplicate task"
                    >
                      <RiFileCopyLine size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteTodo(todo.id); }}
                      className="shrink-0 opacity-0 group-hover:opacity-100 text-base-content/20 hover:text-error/60 transition-all"
                      title="Delete task"
                    >
                      <RiDeleteBinLine size={12} />
                    </button>`;
  code = code.replace(targetDel, newDel);
  
  if (!code.includes("RiFileCopyLine")) {
    code = code.replace(/RiDeleteBinLine, RiCalendarLine/, "RiDeleteBinLine, RiCalendarLine, RiFileCopyLine");
  }
  
  fs.writeFileSync('pages/contacts/[id].tsx', code);
}

patchIndex();
patchContact();
