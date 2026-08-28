-- Read-only query to identify orphaned records caused by deleted targets before ON DELETE CASCADE was applied

-- Orphaned run_profiles
SELECT COUNT(*) as orphaned_run_profiles FROM run_profiles WHERE target_id NOT IN (SELECT id FROM targets);

-- Orphaned run_profile_tracks (cascaded from run_profiles)
SELECT COUNT(*) as orphaned_tracks FROM run_profile_tracks WHERE run_profile_id NOT IN (SELECT id FROM run_profiles);

-- Orphaned logs
SELECT COUNT(*) as orphaned_logs FROM logs WHERE target_id NOT IN (SELECT id FROM targets);

-- Orphaned agent_sessions
SELECT COUNT(*) as orphaned_agent_sessions FROM agent_sessions WHERE target_id NOT IN (SELECT id FROM targets);

-- Orphaned activity_logs
SELECT COUNT(*) as orphaned_activity_logs FROM activity_logs WHERE target_id NOT IN (SELECT id FROM targets);

-- Orphaned todos
SELECT COUNT(*) as orphaned_todos FROM todos WHERE target_id NOT IN (SELECT id FROM targets);

-- Orphaned email_replies
SELECT COUNT(*) as orphaned_email_replies FROM email_replies WHERE target_id NOT IN (SELECT id FROM targets);

-- Orphaned list_targets
SELECT COUNT(*) as orphaned_list_targets FROM list_targets WHERE target_id NOT IN (SELECT id FROM targets);

-- Note: to actually delete these safely, you would execute:
-- DELETE FROM run_profiles WHERE target_id NOT IN (SELECT id FROM targets);
-- DELETE FROM logs WHERE target_id NOT IN (SELECT id FROM targets);
-- DELETE FROM agent_sessions WHERE target_id NOT IN (SELECT id FROM targets);
-- (Other tables with ON DELETE CASCADE applied would auto-clean once target references are fixed, or explicitly delete them if needed).
