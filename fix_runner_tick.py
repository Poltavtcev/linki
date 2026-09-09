import re
with open('lib/linkedin/runner.ts', 'r') as f:
    content = f.read()

tick_insert = r"          if \(returnState === 'SUCCESS' && \(step\.step_type === 'message' \|\| step\.step_type === 'email'\)\) \{\n             const channel = step\.step_type === 'message' \? 'linkedin' : 'email';\n             const ctx = \(result\.status === \"SUCCESS\" \? result\.context : \{\}\) \|\| \{\};\n             const msgId = ctx\.emailMessageId \|\| null;\n             const body = ctx\.linkedinMessage \|\| ctx\.emailBody \|\| null;\n             db\.prepare\(`\n               INSERT INTO outbound_events \(id, run_id, run_profile_id, target_id, step_id, channel, sent_at, message_id, status, body\)\n               VALUES \(\?, \?, \?, \?, \?, \?, datetime\('now'\), \?, 'sent', \?\)\n             `\)\.run\(require\(\"crypto\"\)\.randomUUID\(\), state\.run_id, state\.run_profile_id, state\.target_id, step\.id, channel, msgId, body\);\n          \}"
content = re.sub(tick_insert, "", content, flags=re.MULTILINE)

with open('lib/linkedin/runner.ts', 'w') as f:
    f.write(content)
