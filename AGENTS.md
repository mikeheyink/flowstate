# AGENTS.md — Agent Operating Rules (Always-Loaded)

**Purpose:** Prevent predictable AI failures, enforce project discipline, and ensure changes remain consistent with existing patterns.

## 0) Always Read First (in this order)
1. `Project-Constitution.md`
2. `product/prd.md` and `product/features/*` (scope + acceptance)
3. `architecture/overview.md` + `architecture/adrs/*` (decisions)
4. `design/ux-design-rules.md` (UX constraints)
5. `engineering/engineering-constraints.md`
6. `engineering/repo-conventions.md`
7. `engineering/test-strategy.md`
8. `phases/phase-XX/*` (if working in a specific phase)

If any of these files are missing, create a blocking note and ask what to do.

---

## 1) The Golden Rule
**Read before you write.** Before implementing anything:
- Search the codebase for the closest existing pattern
- Read the file you will modify in full
- Follow established conventions exactly
- If no pattern exists: propose a pattern and ask for approval

---

## 2) Scope & Traceability (Hard Rule)
You may only implement work that traces to:
- a `FEATURE-XXXXX` in `product/features/`
- and (if in a phase) a `TASK-XX` in `phases/phase-XX/impl-plan.md`

**Never invent scope.** If you need new scope, stop and request it via the Product Owner skill.

---

## 3) STOP Conditions (Hard Rule)
Stop immediately and write a short blocking note (and ask the user) if:
- Requirements are ambiguous
- A plan conflicts with ADRs / engineering constraints / UX rules
- You would need to restructure architecture or add a new major pattern
- A DB schema/migration is required and not explicitly approved
- You cannot find an existing pattern and are unsure what convention to follow

---

## 4) Never Do (Hard Rules)
- Never introduce `any` (use `unknown` + narrow, or proper types)
- Never swallow errors (all async calls must handle failures and user feedback where applicable)
- Never commit secrets or keys
- Never add dependencies without justification
- Never refactor unrelated code “while you’re here”
- Never render UI for unimplemented features (no phantom UI)
- Never bypass TypeScript strict mode (no casting around real type problems)

---

## 5) Ask First (Approval Gates)
Ask for explicit approval before:
- Architectural changes (new patterns, major folder restructuring)
- Database schema changes or migrations
- New external integrations (APIs, OAuth scopes)
- Major refactors spanning 3+ files
- Removing features or behavior
- Adding state-management middleware or cross-cutting infra

---

## 6) Boundary Typing Rule
Type and validate **at the boundary** (API/DB/user input). Map once; trust types downstream.
Prefer small mapping utilities (e.g., `fromDb`, `fromApi`) over scattered null fallbacks in UI.

---

## 7) Definition of Done (Before you claim “done”)
- Typecheck passes (0 errors)
- Tests pass as per `engineering/test-strategy.md`
- No dead code, no unused imports
- Error handling is consistent
- UX rules satisfied (loading/error/empty/loaded where applicable)
- Work is traceable to `FEATURE-XXXXX` / `TASK-XX`
- If using the skill workflow: output includes `## Handover` with next skill + docs

---

## 8) If in Doubt
Ask the user. Clarifying early beats rework.
