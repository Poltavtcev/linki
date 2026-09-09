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
Task / Contract -> HostileTester (Fabric) -> Titan -> Supervisor -> OpusRedTeam
```

### Phase 0: INVENTORY, DEBATE & GATE (New Modules Only)
Titan NEVER starts recovery of a new module without Phase 0 inventory.
Before new modules are touched, establish: `DOMAIN.md`, `ARCHITECTURE.md`, `INVARIANTS.md`.
**Council:** If architectural decisions are ambiguous, invoke the `CouncilTeam` subagent to run the LIFEOS `Council` skill (`~/.claude/LIFEOS/.agents/skills/Council/SKILL.md`) for a multi-agent debate to weigh options before committing to a design.

### Phase A: DISCOVERY & CONTRACT
Define the task in `.ai/TASKS/T-[number]-[name].md`. Define the Contract.

### Phase B: ADVERSARIAL TESTER (Red Team 1)
Invoke the **HostileTester** subagent. 
- **Fabric Integration:** Tester MUST use LIFEOS Fabric patterns (`t_red_team_thinking`, `create_threat_scenarios`) from `~/.claude/LIFEOS/.agents/skills/Fabric/SKILL.md` to formally generate failure vectors (e.g. concurrent requests, duplicated webhooks) BEFORE writing tests.
- Tester writes hostile regression/characterization tests to PROVE the system violates the contract.
- Tester MUST verify the test FAILS on the old behavior for the exact right reason.
- This prevents false-confidence.

### Phase C: IMPLEMENTATION (Titan)
Titan implements the fix to make the hostile tests pass, strictly without unrelated structural refactoring.

### Phase D: VALIDATION (Supervisor)
Supervisor runs the automatic regression gate (`scripts/validate.sh`). No ESLint ignore files. Legacy lint debt remains visible, new files strictly checked.

### Phase E: ENGINEERING LEDGER
Before EVERY production git commit, Supervisor MUST create/update a decision record in `.ai/DECISIONS/T-XXX.md`.
Must contain: Problem/Contract, What changed, Files changed, Tests added/changed, Validation result, Risks, Known limitations, Architectural decisions, Deferred work.

### Phase F: INDEPENDENT AUDIT (Opus Red Team 2)
For critical components, hand over the finalized system to the **OpusRedTeam** subagent.
It will use the LIFEOS RedTeam skill (`~/.claude/LIFEOS/.agents/skills/RedTeam/SKILL.md`) to stress-test the implementation, break atomic claims, and produce severity-ranked findings without fixing the code itself.

## 3. Handling Out-of-Scope Issues

If you see an unrelated architectural problem or bug:
**DO NOT FIX IT.**
**REPORT IT.**
Recommend a follow-up task.
