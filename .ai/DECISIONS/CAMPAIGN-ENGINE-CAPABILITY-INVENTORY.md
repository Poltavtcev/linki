# Campaign Engine Capability Inventory & Preservation Contract

## Purpose
This document provides a complete inventory of Campaign Engine capabilities. It serves as a strict regression gate for future structural refactoring. The invariant is:
**Structural refactoring CANNOT remove, disable, silent-FAIL, or silently change the semantic of a capability documented here without explicit approval and an update to this contract.**

## Capability Status Matrix

| Capability / Node Type | UI Configurable | Engine Executable | Historical Source | Current Status | Notes |
|---|---|---|---|---|---|
| `visit` | YES | YES | `old_runner.ts` | **IMPLEMENTED** | |
| `connect` | YES | YES | `old_runner.ts` | **IMPLEMENTED** | |
| `message` | YES | YES | `old_runner.ts` | **IMPLEMENTED** | |
| `email` | YES | YES | `old_runner.ts` | **IMPLEMENTED** | |
| `delay` | YES | YES | `old_runner.ts` | **IMPLEMENTED** | Handled in `tickActions` track advancement. |
| `integration` | YES | YES | `old_runner.ts` | **IMPLEMENTED** | |
| `ai_qualify` | YES | YES | `2cf7752` | **IMPLEMENTED** | New feature (Phase 3). |
| `ai_comment` / `linkedin_like` | YES | YES | `2cf7752` | **IMPLEMENTED** | New feature (Phase 3). |
| `linkedin_enrich` | YES | YES (Restored) | `old_runner.ts` | **IMPLEMENTED** | Restored from NO-OP in P0.3 Audit. |
| `sales_inmail` | YES | NO (NO-OP) | `inHubFlow` | **PARTIAL/REMOVED** | Silent success trap. Needs explicit recovery (DEFERRED). |
| `change_status` | YES | NO (NO-OP) | `old_runner.ts` | **REMOVED** | Silent success trap. |

## Defect Patterns Identified
- **Silent-Success Trap**: The Campaign Engine's `executeStep` had a fallback `else { return { status: "SUCCESS" } }`. Any unknown or unhandled step type (like `sales_inmail`, `change_status`, or formerly `linkedin_enrich`) silently passed as successful. **Refactor Invariant: Unknown/unhandled nodes MUST return a failure/diagnostic state, not SUCCESS.**

## Git Archaeology of Lost Capabilities

### CAP-001: linkedin_enrich (Enrich Profile)
- **Historical Implementation**: `_archive/scripts/old_runner.ts` called `ensureSalesNavEnriched(db, target, accountId)`.
- **Commit of Removal**: `2cf7752cc7c707a72dff00d4d1a1c39618d9c45c` ("feat(playbooks): phase 3 - executor hookup and ai nodes")
- **Intentional?**: NO. Lost during rewrite of DAG runner.
- **Current Replacement**: Used indirectly inside `ai_qualify`, but the explicit node was a NO-OP.
- **Status**: **RESTORED** (via explicit `linkedin_enrich` case in `executeStep`).

### CAP-002: sales_inmail (Sales Navigator InMail)
- **Historical Implementation**: Execution logic was part of a premium enterprise feature (`ee/inmail.ts`) stripped from the open-source tree. Inbound inbox sync relied heuristically on standard messaging URLs and never natively supported Sales Nav Inbox.
- **Commit of Removal**: Pre-dates the local DAG migration; absent in the open-core foundation.
- **Intentional?**: YES. Premium enterprise subsystems were explicitly excluded.
- **Status**: **DEFERRED-INMAIL-001** (See `.ai/DECISIONS/DEFERRED-INMAIL-001.md` for the complete preservation contract and future recovery requirements).

### CAP-003: change_status (Update Lead Status)
- **Historical Implementation**: `_archive/scripts/old_runner.ts` explicitly updated `targets.lead_status`.
- **Commit of Removal**: `2cf7752cc7c707a72dff00d4d1a1c39618d9c45c`
- **Intentional?**: UNCLEAR.
- **Status**: **REMOVED** (Not prioritized for recovery).

## Future Feature Backlog

### DEFERRED-LINKEDIN-INBOX-001
**Full LinkedIn Inbox Persistence**
- *Goal*: Capture ALL inbound LinkedIn messages, regardless of existing campaign status.
- *Mechanism*: Modify `inbox-sync.ts` & `sdr-shim.ts` to allow `unmatched_target` observations to persist.
- *Identity Resolution*: Use URN -> URL normalization -> Auto-create new target if missing.
- *Current Contract Constraint*: Currently, only campaign-bound messages are persisted (this is historically correct). This future feature explicitly expands that contract.

### DEFERRED-INMAIL-001
**Sales Navigator InMail Recovery**
- *Goal*: Restore the `sales_inmail` DAG node capabilities.
