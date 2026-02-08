# PHASE-01: Platform Reliability & Data Integrity

> **Phase ID**: PHASE-01
> **Feature**: FEATURE-00008
> **Goal**: Eliminate silent data loss across all store actions and fix known data integrity bugs.
> **Status**: Complete (QA PASS — 2026-02-08)

---

## Phase Goal

After this phase, every user action in FlowState either succeeds and persists, or fails visibly with state rolled back. No user work is silently lost due to network failures, sync overwrites, or implementation bugs.

---

## Scope

### Included (P0 — Data Integrity)

| ID | Acceptance Criteria | Files Affected |
|----|-------------------|----------------|
| AC-1 | Task store error handling — all DB operations wrapped in try/catch with rollback and toast | `src/store/useTaskStore.ts` |
| AC-2 | Undo/redo correctness — immutable array operations, single execution | `src/store/useTaskStore.ts` |
| AC-3 | Email status preserved across sync — upsert excludes `status` on conflict | `supabase/functions/gmail-sync/index.ts` |

### Included (P1 — Error Handling & Resilience)

| ID | Acceptance Criteria | Files Affected |
|----|-------------------|----------------|
| AC-4 | GmailService error propagation — check `result.success`, rollback on failure | `src/store/useMailStore.ts` |
| AC-5 | sendEmail error handling — try/catch, toast, preserve draft on failure | `src/store/useMailStore.ts`, `src/components/Mail/ComposeModal.tsx` |
| AC-6 | Email CSS isolation via Shadow DOM | `src/components/Mail/ThreadMessage.tsx` (new `EmailContent` component) |
| AC-7 | Type safety at boundaries — replace `any` with typed interfaces | `src/store/useTaskStore.ts`, `src/store/useMailStore.ts`, `src/utils/supabase.ts`, `src/App.tsx` |

---

## Explicit Exclusions

These are **not** in scope for PHASE-01. They are documented to prevent scope creep.

| Item | Reason |
|------|--------|
| Task store slice refactoring (P2, Issue 1.1) | Structural refactoring — separate phase with its own ADR |
| TaskService extraction (P2, Issue 2.1) | Structural refactoring — separate phase |
| useHotkeys splitting (P2, Issue 7.1) | Structural refactoring — separate phase |
| Compose state relocation (P2, Issue 1.4) | Low impact, deferred |
| App.tsx over-subscribing (P2, Issue 7.2) | Low impact, deferred |
| Mail offline queue (P3, Issue 5.1) | High effort, accepted limitation |
| Edge Function splitting (P3, Issue 2.2) | Acceptable at current scale |
| All other P3 items | Deferred per alignment review |

---

## Acceptance Criteria (Phase-Level)

The phase is complete when ALL of the following are true:

1. **Zero silent failures**: Every `await` call in `useTaskStore` and `useMailStore` is wrapped in try/catch with rollback and user-facing feedback.
2. **Undo is correct**: Undo executes exactly once, redo executes exactly once, no array mutation.
3. **Sync preserves triage**: Archiving an email, triggering a sync, and refreshing the page does NOT resurface the email in the inbox.
4. **Gmail errors surface**: A simulated Gmail 403/404 response results in a visible toast and state rollback, not a silent failure.
5. **Send failures preserve drafts**: If `sendEmail` fails, the compose modal remains open with the user's content intact and a toast is shown.
6. **Email styles are isolated**: An email containing `body { background: red; }` in a `<style>` tag does NOT affect FlowState's background color.
7. **No `any` in stores**: `grep -r "any" src/store/useTaskStore.ts src/store/useMailStore.ts` returns zero matches for type annotations (excluding comments and string literals).

---

## Ordering & Dependencies

```
AC-2 (undo fix)           — no dependencies, standalone fix
AC-3 (sync status)        — no dependencies, standalone fix (Edge Function)
AC-1 (task error handling) — no dependencies, but largest scope
AC-4 (Gmail error prop)   — no dependencies
AC-5 (sendEmail errors)   — no dependencies
AC-6 (CSS isolation)      — depends on ADR-0001 (accepted)
AC-7 (type safety)        — should run last, touches files modified by AC-1 and AC-4
```

Recommended execution order: AC-2 → AC-3 → AC-1 → AC-4 → AC-5 → AC-6 → AC-7

Rationale: Start with the smallest, highest-impact fixes (undo bug, sync overwrite). Then address the broad error handling changes. CSS isolation is independent but benefits from being done before the type safety sweep so that the new `EmailContent` component is typed correctly from the start.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| AC-1 (task error handling) introduces regressions in task operations | Medium | High | Test each action individually: add, update, toggle, delete, archive, reorder, indent/outdent. Simulate network failure for each. |
| AC-2 (undo fix) changes history behavior in unexpected ways | Low | High | Write unit tests for undo/redo sequences before changing the implementation. |
| AC-3 (sync upsert change) causes new emails to not appear | Low | High | Test: new email appears in inbox; archived email does not reappear after sync; trashed email does not reappear after sync. |
| AC-6 (Shadow DOM) breaks email click handling or accessibility | Medium | Medium | Verify: links open in new tab, text is selectable, screen reader can access content, keyboard focus works within email body. |
| AC-7 (type removal) surfaces hidden type errors that require broader fixes | Medium | Low | Address type errors as they're found. Do not cast to `any` to fix them — fix the underlying type. |
