# System Invariants (The "Laws of Physics")

These are the non-negotiable rules of the project. You must NEVER break them.

## Campaign Engine State Machine

- **Single Source of Truth**: `run_profile_states` is the EXCLUSIVE source of truth for the DAG runner (`tickActions`).
- **UI Projections**: `run_profile_tracks` is a read-only ghost projection for the UI. It MUST NOT be used for execution decisions.
- **Idempotency**: A logical step (e.g., `sendMessage`) MUST NOT execute its side effect more than once per target per node.
- **Interrupts**: Unenroll, Cancel, and Email Bounce MUST physically halt execution by updating `run_profile_states.state = 'completed'`.
- **Parallel Runs**: Multiple active runs for a single target are forbidden by business logic (enforced in `activeRuns` checks).

## Database

- The database (SQLite) is the strict source of truth.
- Never use local JSON or memory as persistent state.
- Database triggers (e.g., `sync_run_profile_tracks_state`) must be respected; order your updates so triggers don't overwrite intended states.

## Testing

- Every bug MUST have an automated test proving it existed and is fixed.
- Tests MUST invoke actual production code paths (no testing mocks that bypass the system under test).
- Tests must clean up after themselves or use isolated schemas/transactions.

## Authentication & Security

- Internal API routes (e.g., `/api/mcp/*`, cron tasks) MUST verify the caller's identity (via session or `INTERNAL_API_SECRET`).
- Secrets must never be exposed to frontend props unless explicitly masked or scoped to an active admin session.
