import re
with open('lib/linkedin/runner.ts', 'r') as f:
    content = f.read()

bad_block = """
          if ((step.step_type === 'email' || step.step_type === 'message') && returnState === 'SUCCESS') {
             db.prepare("UPDATE run_profile_states SET waiting_for_condition = 'reply', state = 'running' WHERE run_profile_id = ?").run(state.run_profile_id);
             continue;
          }"""

content = content.replace(bad_block, "")
with open('lib/linkedin/runner.ts', 'w') as f:
    f.write(content)
