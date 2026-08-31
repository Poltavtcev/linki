const fs = require('fs');
let code = fs.readFileSync('pages/workflows/[id].tsx', 'utf8');

const oldSummaryBlock = `                    {/* Step sequence */}
                    {(() => {
                      const summaryLiSteps = wizardSteps.map((ws, i) => ({ ws, i })).filter(({ ws }) => ws.track === "linkedin");
                      const summaryEmSteps = wizardSteps.map((ws, i) => ({ ws, i })).filter(({ ws }) => ws.track === "email");
                      const isDualSummary = summaryLiSteps.length > 0 && summaryEmSteps.length > 0;`;

const newSummaryBlock = `                    {/* Step sequence */}
                    {(() => {
                      const summaryLiSteps = wizardSteps.map((ws, i) => ({ ws, i })).filter(({ ws }) => ws.track === "linkedin");
                      const summaryEmSteps = wizardSteps.map((ws, i) => ({ ws, i })).filter(({ ws }) => ws.track === "email");
                      const summaryInSteps = wizardSteps.map((ws, i) => ({ ws, i })).filter(({ ws }) => ws.track === "integration");
                      const isDualSummary = [summaryLiSteps, summaryEmSteps, summaryInSteps].filter(s => s.length > 0).length > 1;`;

code = code.replace(oldSummaryBlock, newSummaryBlock);

const oldTrackRender = `                        {summaryEmSteps.length > 0 && (
                          <div className={isDualSummary ? "border-l border-base-300/30" : ""}>
                            <SummaryTrack steps={summaryEmSteps} trackLabel="Email Track" trackColor="text-warning bg-warning/5" />
                          </div>
                        )}
                      </div>`;

const newTrackRender = `                        {summaryEmSteps.length > 0 && (
                          <div className={isDualSummary ? "border-l border-base-300/30" : ""}>
                            <SummaryTrack steps={summaryEmSteps} trackLabel="Email Track" trackColor="text-warning bg-warning/5" />
                          </div>
                        )}
                        {summaryInSteps.length > 0 && (
                          <div className={isDualSummary ? "border-l border-base-300/30" : ""}>
                            <SummaryTrack steps={summaryInSteps} trackLabel="Integration Track" trackColor="text-accent bg-accent/5" />
                          </div>
                        )}
                      </div>`;

code = code.replace(oldTrackRender, newTrackRender);
fs.writeFileSync('pages/workflows/[id].tsx', code);
