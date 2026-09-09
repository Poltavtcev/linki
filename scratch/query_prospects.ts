import { getDb } from "../lib/db";
const db = getDb();
const workflowId = '919eb68d-3ea6-4798-9e57-e3c6cb0633b2';
const prospects = db.prepare(`
       SELECT rp.id, t.full_name,
              CASE
                WHEN EXISTS (SELECT 1 FROM run_profile_tracks rt_a WHERE rt_a.run_profile_id = rp.id AND rt_a.state = 'in_progress') THEN 'in_progress'
                WHEN EXISTS (SELECT 1 FROM run_profile_tracks rt_a WHERE rt_a.run_profile_id = rp.id AND rt_a.state = 'pending') THEN 'pending'
                WHEN EXISTS (SELECT 1 FROM run_profile_tracks rt_a WHERE rt_a.run_profile_id = rp.id AND rt_a.state = 'failed') THEN 'failed'
                WHEN EXISTS (SELECT 1 FROM run_profile_tracks rt_a WHERE rt_a.run_profile_id = rp.id AND rt_a.state = 'skipped') THEN 'skipped'
                ELSE 'completed'
              END as state,
              COALESCE(rt_li.current_step, 0) as current_step,
              CASE 
                WHEN rt_in.state = 'in_progress' THEN ws_in.step_type
                WHEN rt_em.state = 'in_progress' THEN ws_em.step_type
                WHEN rt_li.state = 'in_progress' THEN ws_li.step_type
                WHEN rt_li.state NOT IN ('completed','skipped') THEN ws_li.step_type
                WHEN rt_em.state NOT IN ('completed','skipped') THEN ws_em.step_type
                ELSE ws_in.step_type
              END as step_type
       FROM run_profiles rp
       JOIN runs r ON r.id = rp.run_id
       JOIN targets t ON t.id = rp.target_id
       LEFT JOIN run_profile_tracks rt_li ON rt_li.run_profile_id = rp.id AND rt_li.track = 'linkedin'
       LEFT JOIN run_profile_tracks rt_em ON rt_em.run_profile_id = rp.id AND rt_em.track = 'email'
       LEFT JOIN run_profile_tracks rt_in ON rt_in.run_profile_id = rp.id AND rt_in.track = 'integration'
       LEFT JOIN workflow_steps ws_li ON ws_li.workflow_id = r.workflow_id AND ws_li.track IN ('linkedin', 'playbook') AND ws_li.step_order = COALESCE(rt_li.current_step, 0) + 1
       LEFT JOIN workflow_steps ws_em ON ws_em.workflow_id = r.workflow_id AND ws_em.track = 'email' AND ws_em.step_order = COALESCE(rt_em.current_step, 0) + 1
       LEFT JOIN workflow_steps ws_in ON ws_in.workflow_id = r.workflow_id AND ws_in.track = 'integration' AND ws_in.step_order = COALESCE(rt_in.current_step, 0) + 1
       WHERE r.workflow_id = ?
`).all(workflowId);

console.log(prospects);
