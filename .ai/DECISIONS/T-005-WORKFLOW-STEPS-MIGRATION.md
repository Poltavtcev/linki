# T-005: Workflow Steps Schema Migration Failure

## 1. Problem Description
A production deployment failed during startup with the following error:
`SqliteError: table workflow_steps_new has 25 columns but 22 values were supplied`

## 2. Root Cause & Affected Migration
The failure occurred in `lib/db.ts` during the `CHECK(step_type IN)` constraint removal migration.
The migration (originally added in `4b24ce14` and modified in `d689be5b`) used a positional insert:
`INSERT INTO workflow_steps_new SELECT * FROM workflow_steps;`
This implicitly assumed the existing production database's `workflow_steps` table had the same number of columns as the newly defined `workflow_steps_new` (25 columns). Because production databases only had 22 columns (lacking `edges_json`, `ai_qualification_rules`, and `ai_comment_prompt`), the statement crashed.

## 3. Fix Implemented
Replaced the positional `SELECT *` with explicit, dynamic column mapping:
1. Dynamically read existing columns using `PRAGMA table_info(workflow_steps)`.
2. Explicitly specify the columns in the insert statement: `INSERT INTO workflow_steps_new (${colList}) SELECT ${colList} ...`
3. Added a destination-column validation loop to fail loudly if a source column doesn't exist in the target schema.
This allows SQLite to properly apply `NULL` or `DEFAULT` values to any newly added columns.

## 4. Test Limitations
A regression test (`tests/regression/schema-migration-4b24ce14.test.ts`) was added to verify the 22→25 column upgrade. Because `runMigrations()` is not exported from `lib/db.ts`, the test explicitly tests the migration logic block (copy-pasted) rather than performing full `runMigrations()` integration coverage. This was deemed acceptable to avoid unnecessary refactoring.

## 5. Production Environment Safety
A production migration failure was actively observed. However, no manual production DB repair or schema alteration was performed during this investigation. The failed migration left the original `workflow_steps` intact due to erroring out before the `DROP TABLE` command. The code fix safely handles the upgrade path on next startup.
