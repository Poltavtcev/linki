# Linki — Change Policy

## Task Lifecycle

Every non-trivial change follows this exact sequence.
No step may be skipped. If a gate fails, the task does not proceed.

```
 ┌─────────────┐
 │  DISCOVER   │  Supervisor identifies work needed
 └──────┬──────┘
        ▼
 ┌─────────────┐
 │   INSPECT   │  Supervisor reads affected code, understands current behavior
 └──────┬──────┘
        ▼
 ┌─────────────┐
 │    PLAN     │  Supervisor writes task definition with scope, constraints,
 └──────┬──────┘  acceptance criteria, forbidden changes, required tests
        ▼
 ┌─────────────┐
 │ RISK CLASS  │  Supervisor classifies as LOW / MEDIUM / HIGH / EXTREME
 └──────┬──────┘  (per PROJECT_CONTRACT.md risk matrix)
        ▼
 ┌─────────────┐
 │ CHECKPOINT  │  git checkpoint BEFORE any implementation
 └──────┬──────┘
        ▼
 ┌─────────────┐
 │  DELEGATE   │  Supervisor sends task to Titan with:
 │  TO TITAN   │  - task definition
 └──────┬──────┘  - affected files
        │         - invariants
        │         - constraints
        │         - required tests
        ▼
 ┌─────────────┐
 │   TITAN     │  Titan implements within scope
 │ IMPLEMENTS  │  Returns: changes + self-test evidence
 └──────┬──────┘
        ▼
 ┌─────────────┐
 │ INDEPENDENT │  Supervisor runs scripts/validate.sh
 │ VALIDATION  │  (NOT relying on Titan's reported results)
 └──────┬──────┘
        │
        ├──── FAIL ──→ STOP → ANALYZE → ISOLATE → REPAIR or REVERT → re-validate
        │
        ▼ PASS
 ┌─────────────┐
 │ DIFF REVIEW │  Supervisor reviews git diff:
 └──────┬──────┘  - scope compliance (no unrelated changes?)
        │         - architectural impact
        │         - suppression additions (@ts-ignore, any, eslint-disable?)
        │         - governance file modifications?
        │
        ├──── FAIL ──→ REJECT → Titan fixes or task reverts
        │
        ▼ PASS
 ┌─────────────┐
 │  INVARIANT  │  Supervisor checks PROJECT_CONTRACT invariants:
 │   CHECK     │  - data integrity
 └──────┬──────┘  - security
        │         - execution safety
        │         - architecture
        │
        ├──── FAIL ──→ REJECT → revert to checkpoint
        │
        ▼ PASS
 ┌─────────────┐
 │ SUPERVISOR  │  All gates passed → task DONE
 │    PASS     │  Git checkpoint with descriptive commit
 └─────────────┘
```

## HIGH / EXTREME Risk Additional Gates

For HIGH and EXTREME risk tasks, the following additional gates apply BEFORE delegation:

1. **Pre-approval** — Supervisor must get human approval for EXTREME risk tasks
2. **Characterization tests** — Write tests capturing current behavior BEFORE making changes
3. **Adversarial review** — After implementation, Supervisor asks: "How could this break the system?" and actively tries to find failures

## Gate Failure Protocol

When any validation gate fails:

```
FAIL detected
    │
    ├─ Is the failure in Titan's changes?
    │   YES → Titan fixes within original scope
    │         → Re-run ALL gates from INDEPENDENT VALIDATION
    │
    ├─ Is the failure a pre-existing issue?
    │   YES → Document as separate finding
    │         → Do NOT fix in current task
    │         → Create new task for it
    │
    ├─ Is the failure unfixable within scope?
    │   YES → REVERT to checkpoint
    │         → Re-evaluate task decomposition
    │
    └─ Did Titan introduce unrelated changes?
        YES → REJECT entire implementation
              → Titan re-implements from checkpoint
```

## What "DONE" Means

A task is DONE if and only if ALL of the following are true:

| Gate | Status |
|------|--------|
| PLAN exists | ✅ |
| IMPLEMENTATION complete | ✅ |
| `scripts/validate.sh` PASS (typecheck) | ✅ |
| Unit tests PASS | ✅ |
| Integration tests PASS (where applicable) | ✅ |
| Regression tests PASS (where applicable) | ✅ |
| Build PASS | ✅ |
| Diff review PASS (scope, no suppressions, no governance changes) | ✅ |
| Invariant check PASS | ✅ |
| Supervisor PASS | ✅ |

If ANY required gate = FAIL → DONE = NO.

## Forbidden Shortcuts

1. ❌ `IMPLEMENT → DONE` (no validation)
2. ❌ Titan self-certifying completion
3. ❌ Skipping typecheck because "it's just a UI change"
4. ❌ Adding `@ts-ignore` / `any` / `eslint-disable` to pass validation
5. ❌ Deleting or weakening tests to achieve green build
6. ❌ "Almost done, moving to next task" (partially validated)
7. ❌ Fixing unrelated issues within current task scope
8. ❌ Expanding scope without Supervisor approval

## Checkpoint Strategy

- **Pre-task checkpoint:** Before any implementation begins (mandatory)
- **Post-task checkpoint:** After all gates pass (mandatory)
- **Mid-task checkpoint:** For multi-step tasks, after each verified sub-step (recommended)

Git commit message format:
```
[risk] scope: description

Task: TASK-ID
Risk: LOW/MEDIUM/HIGH/EXTREME
Gates: typecheck=PASS test=PASS build=PASS review=PASS
```
