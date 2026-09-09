import re

with open('.ai/TASKS/T-001.md', 'r') as f:
    content = f.read()

# Mark Finding 1 as done
content = content.replace("- [ ] Implementation (Targeted Regex/AST patch)", "- [x] Implementation (Targeted Regex/AST patch)")
content = content.replace("- [ ] `tests/integration/t001-characterization.test.ts` MUST PASS", "- [x] `tests/integration/t001-characterization.test.ts` MUST PASS")

# Mark Finding 2 as done
content = content.replace("- [ ] Implementation (Move INSERT into executeStep, add SELECT deduplication)", "- [x] Implementation (Move INSERT into executeStep, add SELECT deduplication)")
content = content.replace("- [ ] `tests/integration/t001-idempotency.test.ts` MUST PASS (Both 2a and 2b)", "- [x] `tests/integration/t001-idempotency.test.ts` MUST PASS (Both 2a and 2b)")

# Mark Finding 3 as done
content = content.replace("- [ ] Implementation (Use `t001-r3-test-fix.test.ts` logic to replace `r3-state-machine.test.ts`)", "- [x] Implementation (Use `t001-r3-test-fix.test.ts` logic to replace `r3-state-machine.test.ts`)")

with open('.ai/TASKS/T-001.md', 'w') as f:
    f.write(content)
