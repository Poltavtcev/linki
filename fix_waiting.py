import re
with open('lib/linkedin/runner.ts', 'r') as f:
    content = f.read()

# find where to insert it: right after the 'connect' block
connect_block = """if (step.step_type === 'connect' && returnState === 'SUCCESS') {
             db.prepare("UPDATE run_profile_states SET waiting_for_condition = 'accept', state = 'running' WHERE run_profile_id = ?").run(state.run_profile_id);
             continue;
          }"""

new_connect_block = connect_block + """
          if ((step.step_type === 'email' || step.step_type === 'message') && returnState === 'SUCCESS') {
             db.prepare("UPDATE run_profile_states SET waiting_for_condition = 'reply', state = 'running' WHERE run_profile_id = ?").run(state.run_profile_id);
             continue;
          }"""

content = content.replace(connect_block, new_connect_block)
with open('lib/linkedin/runner.ts', 'w') as f:
    f.write(content)
