# RECOVERY PLAN — Linki

**Date:** 2026-09-08  
**Classification:** STATE B — REPAIRABLE  
**Prepared by:** AI Engineering Supervisor  

---

## Executive Summary

The Linki codebase is **fundamentally viable** but has accumulated significant debris and hygiene issues from rapid AI-assisted development. The core architecture does not need rewriting. The recovery focuses on three pillars:

1. **Clean the debris** (root-level ad-hoc files, duplicate modules, backups)
2. **Build a safety net** (test framework, TypeScript fixes, CI basics)
3. **Decompose oversized components** (workflows page, settings page)

---

## Priority Classification

### 🔴 CRITICAL — Fix Before Continuing Development

| # | Problem | Cause | Risk | Recommended Action | Notes |
|---|---------|-------|------|-------------------|-------|
| C1 | **No test framework** | Never set up; all testing done ad-hoc | Any change can break anything without detection | Set up Vitest with a minimal initial suite covering runner, db, and API routes | Must do FIRST |
| C2 | **370+ ad-hoc files in project root** | AI debug/patch/fix cycle artifacts never cleaned | Project incomprehensible, hides real source, slows tooling | Move all non-essential files to `_archive/` directory, then gitignore it | Safe, reversible |
| C3 | **TypeScript errors in core code** | Missing type narrowing, stale exports | Runtime errors possible in runner (most critical module) | Fix 18 core TS errors | Small, targeted fix |
| C4 | **INTERNAL_API_SECRET exposed to client** | `settings.tsx:L124-132` passes secret to client via `getServerSideProps`, serialized into `__NEXT_DATA__` HTML | Any browser user or extension can read the internal API secret | Remove from client props; use server-only API for MCP config display | SECURITY FIX |
| C5 | **Debug routes in production** | `pages/api/debug-feed.ts` and `pages/api/test-tick.ts` left from development | Hardcoded account UUID, full error stack exposure | Delete or gate behind auth/env flag | SECURITY FIX |

### 🟡 HIGH — Fix Soon After Stabilization

| # | Problem | Cause | Risk | Recommended Action | Notes |
|---|---------|-------|------|-------------------|-------|
| H1 | **Monolithic `workflows/[id].tsx`** (4,267 LOC) | Organic growth without decomposition | Any change risks breaking unrelated functionality | Extract into subcomponents: StepEditor, EnrolledLeads, DAGVisualizer, WorkflowSettings | Plan carefully |
| H2 | **Monolithic `settings.tsx`** (3,119 LOC) | All tabs in one file | Same as above | Extract tab content into separate components | Lower risk than H1 |
| H3 | **Duplicate TS/JS modules** (`db`, `session`, `crypto`) | Historical migration never completed | Import confusion, potential runtime divergence | Determine canonical version, delete duplicates | Need to verify which is imported |
| H4 | **No migration system** | Inline schema detection on startup | No rollback, risk of data corruption on schema changes | Add migration version tracking table + sequential numbered migrations | Must preserve existing data |
| H5 | **Backup files in source tree** | Development artifacts left behind | Confusion, accidental imports | Remove `*.bak`, `old_runner.ts` | Trivial |
| H6 | **Stale/empty database files** | Development artifacts | Confusion | Remove `database.sqlite`, `db.sqlite`, `lib/dyad.db`, `lib/linki.db` (all 0-byte) | Trivial |
| H7 | **Unused `sqlite3` dependency** | Historical, not removed | Unnecessary dependency weight, potential confusion | Remove from `package.json` | Verify no imports first |
| H8 | **@types packages in `dependencies`** | Misplacement | No runtime impact, but incorrect | Move to `devDependencies` | Trivial |

### 🟠 MODERATE — Fix When Convenient

| # | Problem | Cause | Risk | Recommended Action | Notes |
|---|---------|-------|------|-------------------|-------|
| M1 | **No CI/CD pipeline** | Not set up | No automated verification on push | Add basic GitHub Actions: typecheck + lint + test | After test framework exists |
| M2 | **Incomplete `.gitignore`** | Only `patch_*.js` ignored | Ad-hoc files tracked/visible | Expand gitignore for common patterns | After C2 cleanup |
| M3 | **In-memory runner state** | Architecture decision | State lost on restart | Document as known limitation; consider SQLite-backed state for critical counters | Low urgency — WAL mode handles most concurrency |
| M4 | **No ESLint enforcement** | Not running in workflow | Code style inconsistencies | Add ESLint to CI pipeline | After M1 |
| M5 | **Global mutable state in runner** | Performance optimization | Can cause subtle bugs between HMR reloads | Add instance ID tracking (partially done per git history) | Monitor, don't refactor yet |
| M6 | **`db.ts` combines schema + queries + migrations** | Organic growth | Large file, mixed concerns | Future: split into `schema.ts`, `migrations.ts`, `queries/` | NOT urgent — it works |

### 🟢 LOW — Can Defer

| # | Problem | Cause | Risk | Recommended Action | Notes |
|---|---------|-------|------|-------------------|-------|
| L1 | **Large page components** (contacts, lists, inbox) | Organic growth | Moderate maintenance burden | Decompose when next touching these files | DON'T do proactively |
| L2 | **No observability/monitoring** | Self-hosted product | Production issues harder to diagnose | Consider structured logging | User-dependent need |
| L3 | **Missing API input validation** | Unknown without deep audit | Potential injection or bad data | Audit API routes, add Zod schemas | Good practice but not urgent |

### ⬜ DO NOT TOUCH

| # | Item | Reason |
|---|------|--------|
| N1 | **Core runner architecture** | Works, is the most critical and fragile module. Don't refactor without compelling reason. |
| N2 | **LinkedIn automation layer** | Well-decomposed into separate modules (connect, message, visit, etc.). Leave it alone. |
| N3 | **Database schema** | 27 tables, reasonable structure. No redesign needed. |
| N4 | **Auth/security implementation** | NextAuth + bcrypt + AES-256-GCM. Correctly implemented. |
| N5 | **Deployment/Docker setup** | Pinned Chromium, proper Dockerfile. Don't touch. |
| N6 | **Open-core (ee/) gating** | Working mirror-ee.js system. Don't change. |

---

## Execution Order

```
Phase 1: STABILIZE (Before any new feature work)
├── C4: Fix INTERNAL_API_SECRET client exposure (SECURITY)
├── C5: Remove/gate debug API routes (SECURITY)
├── C2: Archive root debris → _archive/
├── H5: Remove .bak files  
├── H6: Remove stale empty DB files
├── C3: Fix 18 core TypeScript errors
├── C1: Set up Vitest + minimal test suite
│   ├── Test: db.ts critical functions
│   ├── Test: runner.ts tick logic (unit)
│   ├── Test: API route responses (integration)
│   └── Test: crypto.ts encrypt/decrypt roundtrip
├── H3: Resolve TS/JS duplicate modules
├── H7: Remove unused sqlite3 dependency
└── H8: Move @types to devDependencies

Phase 2: SAFETY NET (Can overlap with careful feature work)
├── M1: Basic CI pipeline (typecheck + test)
├── M2: Expand .gitignore
├── H4: Add migration version tracking
└── M4: ESLint enforcement

Phase 3: DECOMPOSITION (Planned, incremental)
├── H1: Decompose workflows/[id].tsx
├── H2: Decompose settings.tsx
└── M6: Split db.ts (only if needed)

Phase 4: PRODUCTION HARDENING
├── L3: API input validation audit
├── L2: Structured logging
└── Production Readiness checklist
```

---

## Constraints

1. **No big-bang refactoring.** Each step must be small, testable, and reversible.
2. **Runner is hands-off** unless fixing a specific, reproduced bug.
3. **No database schema changes** without migration tracking in place (after H4).
4. **Every bug fix produces a regression test** where practical.
5. **Feature work pauses** until Phase 1 is complete.
6. **The ad-hoc root files contain debugging knowledge.** Archive, don't delete. Some may contain useful test logic to extract into the real test suite.

---

## Risk Assessment

| Action | Risk Level | Mitigation |
|--------|-----------|------------|
| Archiving root files (C2) | LOW | Move to `_archive/`, git tracks the move |
| Fixing TS errors (C3) | LOW | Type-only changes, no runtime impact |
| Setting up Vitest (C1) | LOW | Additive, no existing code changes |
| Removing duplicate JS modules (H3) | MODERATE | Must verify import resolution first |
| Decomposing workflows page (H1) | HIGH | Must plan carefully, test manually |
| Adding migration system (H4) | MODERATE | Must preserve existing data |

---

## Success Criteria for Phase 1

- [ ] Root directory has <30 files (excluding config)
- [ ] `tsc --noEmit` produces 0 errors in `lib/`, `pages/`, `components/`, `ee/`
- [ ] Vitest runs with >0 passing tests
- [ ] No `.bak` files in source tree
- [ ] No duplicate TS/JS modules
- [ ] `package.json` dependencies cleaned up
