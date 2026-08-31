const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

const oldHeader = `                    <div className="flex items-center gap-2 mb-1">
                      {track === "linkedin" ? (
                        <RiLinkedinBoxLine size={20} className="text-primary" />
                      ) : (
                        <RiMailLine size={20} className="text-warning" />
                      )}
                      <h2 className="text-xl font-semibold">{track === "linkedin" ? "LinkedIn steps" : "Email steps"}</h2>
                    </div>
                    <p className="text-base-content/50 text-sm mb-6">
                      {track === "linkedin"
                        ? "Profile visit, connection request, and follow-up message steps. Run in sequence."
                        : "Cold email and follow-ups. Run in sequence, independently of the LinkedIn track."}`;

const newHeader = `                    <div className="flex items-center gap-2 mb-1">
                      {track === "linkedin" ? (
                        <RiLinkedinBoxLine size={20} className="text-primary" />
                      ) : track === "email" ? (
                        <RiMailLine size={20} className="text-warning" />
                      ) : (
                        <RiPlugLine size={20} className="text-accent" />
                      )}
                      <h2 className="text-xl font-semibold">{track === "linkedin" ? "LinkedIn steps" : track === "email" ? "Email steps" : "Integration steps"}</h2>
                    </div>
                    <p className="text-base-content/50 text-sm mb-6">
                      {track === "linkedin"
                        ? "Profile visit, connection request, and follow-up message steps. Run in sequence."
                        : track === "email"
                        ? "Cold email and follow-ups. Run in sequence, independently of the LinkedIn track."
                        : "Third-party APIs and webhooks. These run independently and can push data to CRMs or enrich leads."}`;

code = code.replace(oldHeader, newHeader);
fs.writeFileSync('pages/workflows/[id].tsx', code);
