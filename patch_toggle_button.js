const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

const anchor = `<input 
                        type="checkbox" 
                        className="toggle toggle-success border-base-content/30"
                        checked={crossOverlap}
                        onChange={async (e) => {
                          const checked = e.target.checked;
                          setCrossOverlap(checked);
                          await fetch(\`/api/workflows/\${workflowId}\`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ allow_cross_campaign_overlap: checked ? 1 : 0 })
                          });
                        }}
                      />`;

const replace = `<button
                        type="button"
                        className={\`btn btn-sm w-16 \${crossOverlap ? "btn-success" : "btn-outline border-base-300"}\`}
                        onClick={async () => {
                          const checked = !crossOverlap;
                          setCrossOverlap(checked);
                          await fetch(\`/api/workflows/\${workflowId}\`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ allow_cross_campaign_overlap: checked ? 1 : 0 })
                          });
                        }}
                      >
                        {crossOverlap ? "ON" : "OFF"}
                      </button>`;

code = code.replace(anchor, replace);
fs.writeFileSync('pages/workflows/[id].tsx', code);
