const fs = require('fs');
let code = fs.readFileSync('pages/contacts/index.tsx', 'utf8');

const targetState = `const [newContactForm, setNewContactForm] = useState({ full_name: "", linkedin_url: "", title: "", company: "", location: "", email: "", phone: "", list_id: "" });`;
const newState = `const [newContactForm, setNewContactForm] = useState({ first_name: "", last_name: "", linkedin_url: "", title: "", company: "", location: "", email: "", phone: "", list_id: "" });`;
code = code.replace(targetState, newState);

const targetReset = `setNewContactForm({ full_name: "", linkedin_url: "", title: "", company: "", location: "", email: "", phone: "", list_id: "" });`;
const newReset = `setNewContactForm({ first_name: "", last_name: "", linkedin_url: "", title: "", company: "", location: "", email: "", phone: "", list_id: "" });`;
code = code.replace(targetReset, newReset);

const targetForm = `<div className="col-span-2">
                  <label className="label text-xs text-base-content/50 pb-1">Full name *</label>
                  <input
                    className="input input-bordered input-sm w-full bg-base-300/50"
                    placeholder="Jane Smith"
                    value={newContactForm.full_name}
                    onChange={(e) => setNewContactForm({ ...newContactForm, full_name: e.target.value })}
                    required
                  />
                </div>`;
const newForm = `<div>
                  <label className="label text-xs text-base-content/50 pb-1">First name *</label>
                  <input
                    className="input input-bordered input-sm w-full bg-base-300/50"
                    placeholder="Jane"
                    value={newContactForm.first_name}
                    onChange={(e) => setNewContactForm({ ...newContactForm, first_name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label text-xs text-base-content/50 pb-1">Last name</label>
                  <input
                    className="input input-bordered input-sm w-full bg-base-300/50"
                    placeholder="Smith"
                    value={newContactForm.last_name}
                    onChange={(e) => setNewContactForm({ ...newContactForm, last_name: e.target.value })}
                  />
                </div>`;
code = code.replace(targetForm, newForm);

fs.writeFileSync('pages/contacts/index.tsx', code);
