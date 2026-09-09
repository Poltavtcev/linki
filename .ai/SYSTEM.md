# AI Engineering System

This is the primary operating system for AI development on this project. 
You are not allowed to bypass this system. You execute **verified engineering tasks**, not "build my product" requests.

## 1. Absolute Rules

1. **Never modify unrelated files.** Stick exclusively to the scope of your current task.
2. **Never change public API contracts without explicit approval.**
3. **Never change database schema without a migration.**
4. **Never remove a test to make the suite pass.**
5. **Never weaken an assertion to make a test pass.**
6. **Never disable lint/typecheck (`@ts-ignore`, `eslint-disable`).**
7. **Never introduce a workaround without documenting why.**
8. **Never replace working architecture without explicit approval.**
9. **Never silently change existing behavior.**
10. **If uncertain, STOP and report the uncertainty.**

## 2. Engineering Lifecycle (The Harness)

For every task you perform, you MUST follow this exact sequence:

```text
SPEC -> PLAN -> IMPLEMENT -> TEST -> ADVERSARIAL REVIEW -> COMMIT
```

### Phase A: DISCOVERY & ANALYSIS ONLY
When a user asks you to implement something, your FIRST response must be an analysis, containing:
1. What will change
2. Files affected
3. APIs & DB affected
4. Existing behavior affected
5. Potential regressions & required tests
*You must not modify code during this phase.*

### Phase B: CREATE A TASK
Every change must be tracked in `.ai/TASKS/T-[number]-[name].md`.
Use the task template to define the scope, preconditions, and forbidden changes.

### Phase C: IMPLEMENTATION & BUG=TEST RULE
If you are fixing a bug, you **MUST** write a failing test first. 
Once the test fails, you may implement the fix until the test passes.

### Phase D: AUTOMATIC REGRESSION GATE
Before finishing, you MUST run:
`npm run validate` (or `npm test && npm run typecheck`)
If ANY test fails, you are FORBIDDEN from moving to the next task. You must fix the regression.

### Phase E: ADVERSARIAL REVIEW (RED TEAM)
For high-risk features, a second AI (or Opus subagent) must review the diff. 
The Red Team's prompt is: *"How can this break?"*

### Phase F: GIT CHECKPOINTS
Use `git add . && git commit -m "..."` constantly. If you break the workspace, use `git reset --hard` to rollback to a known good state.

## 3. Handling Out-of-Scope Issues

If you see an unrelated architectural problem or bug:
**DO NOT FIX IT.**
**REPORT IT.**
Recommend a follow-up task.
