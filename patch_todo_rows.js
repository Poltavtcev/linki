const fs = require('fs');

function patchIndex() {
  let code = fs.readFileSync('pages/todos/index.tsx', 'utf8');
  
  const target = `{todo.due_date && (
                            <span className={\`inline-flex items-center gap-1 text-xs \${isOverdue ? "text-error" : "text-base-content/40"}\`}>
                              <RiCalendarLine size={11} />
                              {new Date(todo.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </div>
                      </div>`;
  const replacement = `{todo.due_date && (
                            <span className={\`inline-flex items-center gap-1 text-xs \${isOverdue ? "text-error" : "text-base-content/40"}\`}>
                              <RiCalendarLine size={11} />
                              {new Date(todo.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center pr-2 mt-0.5">
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
  code = code.replace(target, replacement);
  fs.writeFileSync('pages/todos/index.tsx', code);
}

function patchContact() {
  let code = fs.readFileSync('pages/contacts/[id].tsx', 'utf8');
  
  const target = `{todo.due_date && (
                          <span className={\`inline-flex items-center gap-1 text-[11px] \${overdue ? "text-error" : "text-base-content/30"}\`}>
                            <RiCalendarLine size={11} />
                            {new Date(todo.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                    </div>`;
  const replacement = `{todo.due_date && (
                          <span className={\`inline-flex items-center gap-1 text-[11px] \${overdue ? "text-error" : "text-base-content/30"}\`}>
                            <RiCalendarLine size={11} />
                            {new Date(todo.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center pr-2 mt-0.5">
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
  code = code.replace(target, replacement);
  fs.writeFileSync('pages/contacts/[id].tsx', code);
}

patchIndex();
patchContact();
