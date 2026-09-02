const fs = require('fs');

let code = fs.readFileSync('pages/lists/[id].tsx', 'utf8');

// Insert state and save function
const hookCode = `  const [listName, setListName] = useState(initialList.name);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(initialList.name);
  const [nameSaving, setNameSaving] = useState(false);

  async function saveListName() {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === listName) {
      setEditingName(false);
      setNameValue(listName);
      return;
    }
    setNameSaving(true);
    const res = await fetch(\`/api/lists/\${initialList.id}\`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    setNameSaving(false);
    if (res.ok) {
      setListName(trimmed);
      setEditingName(false);
      toast.success("Renamed");
    } else {
      toast.error("Failed to rename list");
    }
  }

  const [targets, setTargets] = useState<Target[]>(initialList.targets);`;

code = code.replace(
  '  const [targets, setTargets] = useState<Target[]>(initialList.targets);',
  hookCode
);

// Replace UI
const uiOld = `<div className="flex-1">
          <h1 className="text-xl font-semibold">{initialList.name}</h1>
          {initialList.description && (
            <p className="text-base-content/50 text-sm mt-0.5">{initialList.description}</p>
          )}
        </div>`;

const uiNew = `<div className="flex-1">
          {editingName ? (
            <input
              autoFocus
              className="input input-sm input-bordered bg-base-300/50 font-semibold text-lg w-64 mb-1"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={saveListName}
              onKeyDown={(e) => { if (e.key === "Enter") saveListName(); if (e.key === "Escape") { setEditingName(false); setNameValue(listName); } }}
              disabled={nameSaving}
            />
          ) : (
            <h1 
              className="text-xl font-semibold cursor-pointer hover:text-primary transition-colors inline-block" 
              onClick={() => { setNameValue(listName); setEditingName(true); }}
              title="Click to rename"
            >
              {listName}
            </h1>
          )}
          {initialList.description && (
            <p className="text-base-content/50 text-sm mt-0.5">{initialList.description}</p>
          )}
        </div>`;

code = code.replace(uiOld, uiNew);

fs.writeFileSync('pages/lists/[id].tsx', code);
