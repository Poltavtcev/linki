# R3: State Machine Recovery - PASS

### Forensics & Discovery
The DAG Runner (`lib/linkedin/runner.ts`) determines what to run EXCLUSIVELY by querying the `run_profile_states` table. The `run_profile_tracks` table is a ghost/read-only projection used only by the UI and kept in sync by a one-way SQLite trigger (`sync_run_profile_tracks_state`).

However, multiple API endpoints (`retry.ts`, `unenroll.ts`, `cancel-followup.ts`, `inbox.ts`, and `mcp/server.ts`) mutated ONLY `run_profile_tracks.state`. 
Because there is no reverse-trigger to propagate state back to `run_profile_states`, the DAG runner completely ignored these updates.
- **Impact of Bug (Retry):** Clicking "Retry" in the UI moved the contact to "In Progress" visually, but the DAG runner completely ignored them (they remained `failed` internally).
- **Impact of Bug (Unenroll/Bounce):** Manually unenrolling a contact or a contact bouncing would move them to "Skipped" visually, but the DAG runner would continue messaging them because they were still `pending` internally! When the runner eventually finished a step, the DB trigger would overwrite the user's `skipped` state back to `in_progress`. 

### State Machine Contract
1. `run_profile_states` is the single source of truth for the Campaign Engine.
2. API operations (retry, unenroll, cancel) MUST update `run_profile_states.state` to influence the runner.
3. UI projection updates (`run_profile_tracks`) MUST occur AFTER `run_profile_states` updates if they diverge from the standard trigger (e.g. `skipped`), so the trigger does not overwrite them in the same transaction.

### Fixes Implemented
I have surgically fixed the split-brain state mutations by explicitly updating `run_profile_states` first, followed by `run_profile_tracks`:
- `pages/api/runs/[id]/retry.ts`: Sets `run_profile_states.state = 'pending'` to correctly resume.
- `pages/api/runs/[id]/unenroll.ts`: Sets `run_profile_states.state = 'completed'` to correctly halt.
- `pages/api/inbox/[replyId]/cancel-followup.ts`: Sets `run_profile_states.state = 'completed'` to correctly halt.
- `lib/email/inbox.ts`: Sets `run_profile_states.state = 'completed'` on bounce to correctly halt.
- `lib/mcp/server.ts`: Sets `run_profile_states.state = 'completed'` to correctly halt.

*Note: No unrelated refactoring was done. The DB trigger architecture was preserved as instructed.*

### Validation & Regression Tests
- Added `tests/integration/r3-state-machine.test.ts`.
- Verified 100% production-coupled test for `retry.ts` logic mapping to `tickActions`.
- Verified 100% production-coupled test for `unenroll.ts` logic mapping to `tickActions`.
- The entire test suite remains green (`27 passed`).
- Negative proof: Before the fix, the unenroll test failed because `tickActions` would still pick up the contact and overwrite the state. It now passes seamlessly.

### Open Red Team Findings Addressed
This heavily impacts **NB-4 (State Machine Corruption Risks)**, as the previous one-way state projection was actively causing pipeline desyncs and ignoring safety brakes like unenrollments. 

### Next Steps
With Forensics, R0, R1, R2, and R3 now completed and validated, the codebase is stable and accurately adheres to the intended state-machine contract. We are now ready for **RED TEAM #2 — Full Campaign Engine adversarial review**.
