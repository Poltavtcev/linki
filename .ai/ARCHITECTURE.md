# ARCHITECTURE: Campaign Sources

## explicit_membership
Campaigns do not magically inherit lists via target overlaps. Lists must be explicitly attached to campaigns.
- Entity: `run_lists` table tracks explicit membership.
- Columns: `run_id`, `list_id`, `added_at`.

## strict_attribution
- Entity: `run_profiles.source_list_id`
- When a target is enrolled into a campaign via a List, the `source_list_id` is recorded.
- If the target is subsequently "added" again via a different list, the enrollment is skipped (already enrolled), and the new list receives zero credit for this target.
- "Per-list progress" in UI strictly queries `run_profiles WHERE source_list_id = ?`.
