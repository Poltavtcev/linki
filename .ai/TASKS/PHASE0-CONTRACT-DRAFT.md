# Phase 0 Contract: Campaign ↔ Lists Refactor

## Proposed Model

### 1. DB Schema Changes
- `CREATE TABLE run_lists (run_id TEXT, list_id TEXT, is_original INTEGER, added_at TEXT, PRIMARY KEY(run_id, list_id))`
- Add column `source_list_id TEXT REFERENCES lists(id)` to `run_profiles`.
- Remove or deprecate `runs.list_id` (migration will move existing `runs.list_id` into `run_lists` and set `source_list_id` for existing `run_profiles`).

### 2. Lifecycles & Operations
- **Campaign Creation**: Creates `run_lists` entry (is_original=1). All enrolled targets get `source_list_id = list_id`.
- **Add List to Campaign (/enroll)**:
  - Frontend passes `list_id` alongside `target_ids`.
  - Backend creates `run_lists` entry if it doesn't exist.
  - Backend deduplicates `target_ids`.
  - Newly inserted `run_profiles` get `source_list_id = list_id`.
- **Duplicate Targets (List A vs List B)**:
  - Target T is in List A and B. List A added to Campaign. T gets `source_list_id = A`.
  - List B added later. T is skipped. List B's "enrolled" count for this campaign gets 0 credit for T.
- **Repeat Addition**: Adding the same list again ignores the `run_lists` insertion (ON CONFLICT IGNORE). Any new targets not previously enrolled will be enrolled and attributed to this list.
- **Deletions**:
  - Delete Campaign: Cascades to `run_lists` and `run_profiles`.
  - Delete List: Cascades to `run_lists`. `run_profiles.source_list_id` becomes NULL (using ON DELETE SET NULL), which means the targets remain in the campaign but lose list attribution.

### 3. UI Projections
- **Campaign UI (Sources)**: Selects from `run_lists`. Shows "List Size" (COUNT list_targets) and "Enrolled" (COUNT run_profiles WHERE source_list_id = list_id).
- **List UI (Campaign History)**: Selects from `run_lists WHERE list_id = X`. Shows:
  - List Size: `COUNT(list_targets)`
  - Enrolled from this list: `COUNT(rp.id) WHERE rp.source_list_id = X`
  - Per-list Progress: `COUNT(completed) WHERE rp.source_list_id = X`
  - Total Campaign Progress: `COUNT(completed) / COUNT(rp.id) across entire run`

## HostileTester Task
Please aggressively review this proposed contract for edge cases, UX confusion, data integrity holes, or architectural ambiguity.
Focus heavily on:
1. What happens if a target is enrolled via an API directly (no list)? (e.g. `source_list_id` is NULL).
2. What happens if a List is deleted? (ON DELETE SET NULL means UI math might suddenly not sum up to total Campaign targets. Is that acceptable?)
3. Are there any race conditions when adding lists?
4. Will users be confused if List B has 100 targets, they add it, but it shows "0 enrolled" because List A already enrolled them?
