# DEFERRED-CAMPAIGN-LISTS-001 — Explicit Campaign ↔ Lists Membership & Per-List Progress

## 1. The Core Defect
Currently, the system models the `Campaign ↔ Lists` relationship using a single scalar column (`runs.list_id`) which only tracks the *original* list used to create a campaign. Subsequent lists added via the "Add Contacts" UI (`/enroll`) send raw `target_ids` and completely lose the explicit relationship to their source lists. 

As a result:
- The exact `Campaign ↔ List` membership is lost.
- Target overlap via `list_targets` cannot be used to reliably infer if a list was explicitly added by the user.
- The "Campaign History" UI inside a List displays the global progress of the entire campaign (e.g., `2/2583`) rather than the progress of the leads originating from that specific list (e.g., `77 leads`), leading to an opaque UX.

## 2. Core Architectural Contracts (Future)
When resolving this defect, the implementation must strictly separate two conceptual relationships:

- **`Campaign ↔ List`**: Explicit user-selected source/membership (e.g., "The user deliberately attached this batch/list to the campaign").
- **`Campaign ↔ Target`**: Actual operational enrollment and execution (`run_profiles`).

*Note: The exact schema (e.g., a `run_lists` table) is not finalized here. The design must be addressed during the actual implementation phase.*

## 3. UI/UX Requirements

### Requirement 1: Explicit Campaign Sources / Membership
The Campaign UI must display a clear, explicit list of which lists have been added as sources. 

**Target UX:**
```text
Campaign: Збагачення лінкедін

[x] List A       77 leads     added 9/10
[x] List B       172 leads    added 9/10
[x] List C       119 leads    added 9/10
[ ] List D       305 leads    not added
[ ] List E       641 leads    not added
```
*(Status `[x]` MUST represent the explicit action of adding the list, never inferred overlap).*

### Requirement 2: Transparent Per-List Campaign Progress
The Lists UI "Campaign History" must stop blending global campaign numbers with local list counts. The UI must clearly differentiate:
- **List size:** Physical count of leads in the List.
- **Enrolled from List:** How many targets from this specific list successfully entered the campaign after dedup/filtering.
- **Progress for this List:** How many of those *enrolled* targets have completed execution.
- **Total Campaign Progress:** The global execution status.

**STATUS: IMPLEMENTED**
The architectural refactor was fully implemented and validated (including UX projection fixes for `pages/lists/index.tsx`, `pages/lists/[id].tsx`, and `pages/workflows/[id].tsx`). We introduced the `run_lists` join table, updated `/enroll` to accept and record `list_id`, handled concurrency via `ON CONFLICT DO NOTHING`, and corrected SQL aggregations (`json_group_array`) to correctly present the 1:N List-to-Campaign UX.
