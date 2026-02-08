# FEATURE-00008: Platform Reliability & Data Integrity

> **Feature ID**: FEATURE-00008
> **Module**: Core
> **Status**: Implemented
> **References**: [Architecture Alignment Review](../../architecture/architecture-alignment-review.md) — P0 and P1 issues

---

## Problem Statement

Users trust FlowState with their task data and email triage decisions. Today, several code paths can silently lose user work:

1. **Task mutations can fail without the user knowing** — If a network request fails after an optimistic update, the UI shows a successful change but the data is never persisted. The user believes their work is saved when it isn't.
2. **Undo can corrupt state** — The undo implementation has a double-execution bug that can delete a task twice or restore an already-restored task.
3. **Email triage is undone by sync** — When a user archives or trashes an email, a subsequent Gmail sync overwrites the status, causing the email to reappear in the inbox.
4. **Email send failures are silent** — If sending an email fails, the user receives no feedback and the draft is lost.
5. **Gmail API errors are ignored** — If Gmail returns an error (403, 404, rate limit), the mail store ignores it — no rollback, no feedback.

These are not edge cases. They occur during normal usage with intermittent connectivity, Gmail API rate limits, or Supabase downtime.

---

## User Stories

- As a user, I want every task action I take to either succeed or clearly tell me it failed — so I never lose work silently.
- As a user, I want undo/redo to work reliably every time — so I can confidently reverse mistakes.
- As a user, I want my email triage decisions (archive, trash, label) to persist across syncs — so I don't re-process emails I've already handled.
- As a user, I want to know if sending an email fails — so I can retry or save my draft.
- As a user, I want Gmail API errors to be surfaced clearly — so I understand when actions didn't complete.

---

## Acceptance Criteria

### AC-1: Task store error handling (P0)

- Every task store action that writes to the database (`addTask`, `updateTask`, `toggleTask`, `deleteTask`, `archiveTask`, `setPriority`, and all batch/ordering operations) must have try/catch with:
  - Rollback of the optimistic update on failure
  - User-facing toast notification describing the failure
  - Console error logging with context
- The existing `queueOperation` helper (which already handles try/catch, rollback, and offline queueing) should be used where applicable.

### AC-2: Undo/redo correctness (P0)

- The undo method must not mutate the history array directly (no `.pop()`, `.push()`, `.splice()` on state).
- Undo and redo must each execute the command exactly once.
- After undo, the state must match the state before the original action was performed.
- After redo, the state must match the state after the original action was performed.

### AC-3: Email status preserved across sync (P0)

- When the Gmail sync Edge Function upserts emails, it must not overwrite the `status` column for emails that already exist in the database.
- New emails (INSERT) receive `status = 'inbox'`.
- Existing emails (UPDATE on conflict) retain their current status.
- A user who archives an email and then triggers a sync must not see that email reappear in the inbox.

### AC-4: GmailService error propagation (P1)

- When `GmailService` returns `{ success: false, error: message }`, the calling mail store action must:
  - Rollback the optimistic update
  - Show a user-facing toast with the error
  - Log the error to console
- This applies to: `archiveEmail`, `trashEmail`, `markAsRead`, `markAsUnread`, `addLabel`, `removeLabel`.

### AC-5: sendEmail error handling (P1)

- `sendEmail` must have try/catch wrapping the `GmailService.sendEmail` call.
- On failure: show a toast notification ("Failed to send email"), log the error.
- The compose modal must not close on send failure — the user's draft must be preserved.

### AC-6: Email CSS isolation (P1)

- Email HTML content must be rendered in an isolated context (Shadow DOM or `<iframe srcdoc>`) so that email styles cannot affect FlowState's application styles.
- The `style` tag must not be in DOMPurify's `ADD_TAGS` list until isolation is in place.

### AC-7: Type safety at boundaries (P1)

- No `any` type annotations in production store files (`useTaskStore.ts`, `useMailStore.ts`, `useUIStore.ts`, `useCoachStore.ts`).
- Define typed interfaces for: `DbTask` (database row shape), `DbEmail` (database row shape), Supabase session.
- All boundary mapping functions must accept and return typed values — no `any` parameters.

---

## Out of Scope

- Refactoring the task store into slices (P2 — separate effort)
- Extracting a TaskService abstraction (P2 — separate effort)
- Splitting the hotkeys hook (P2 — separate effort)
- Mail offline queue (P3 — deferred, accepted limitation)
- Lie-fi detection (P3 — deferred)

---

## Priority

This feature is **the highest priority work item**. P0 acceptance criteria (AC-1, AC-2, AC-3) must be completed before any new feature development. P1 criteria (AC-4 through AC-7) should follow immediately after.
