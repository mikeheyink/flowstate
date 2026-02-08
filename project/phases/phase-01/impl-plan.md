# PHASE-01: Implementation Plan

> **Phase**: PHASE-01 — Platform Reliability & Data Integrity
> **Feature**: FEATURE-00008
> **Status**: Complete (QA PASS)

---

## Task Index

| Task ID | Title | AC | Depends On | Effort | Status |
|---------|-------|----|------------|--------|--------|
| TASK-01 | Fix undo double-execution bug | AC-2 | — | Small | Done |
| TASK-02 | Fix Gmail sync upsert to preserve email status | AC-3 | — | Small | Done |
| TASK-03 | Wrap task store actions in queueOperation | AC-1 | — | Large | Done |
| TASK-04 | Add result.success checks to mail store GmailService calls | AC-4 | — | Medium | Done |
| TASK-05 | Add error handling to sendEmail | AC-5 | — | Small | Done |
| TASK-06 | Create EmailContent component with Shadow DOM | AC-6 | — | Medium | Done |
| TASK-07 | Replace `any` types with typed interfaces | AC-7 | TASK-03, TASK-04 | Medium | Done |

---

## Task Details

### TASK-01: Fix undo double-execution bug

**AC**: AC-2
**File**: `src/store/useTaskStore.ts`
**Depends on**: None

**Problem**: The `undo` method (lines ~1039-1063) calls `state.history.pop()` which directly mutates the Zustand state array. The code then attempts a clean copy-based approach below, resulting in the undo command executing twice.

**Implementation**:
1. Replace the entire `undo` method with:
   ```typescript
   undo: async () => {
     const state = get();
     if (state.history.length === 0) return;
     const history = [...state.history];
     const command = history.pop()!;
     await command.undo();
     set({ history, future: [command, ...state.future] });
   },
   ```
2. Verify the `redo` method (lines ~1065-1077) uses immutable operations — it currently uses `[...state.future]` and `.shift()` on the copy, which is correct. No changes needed for redo.

**Test hooks**:
- Unit test: `undo` executes command.undo exactly once (mock command, assert call count)
- Unit test: `redo` executes command.redo exactly once
- Unit test: undo followed by redo restores original state
- Unit test: undo on empty history is a no-op
- Unit test: history array in store is a new reference after undo (not mutated)

**Done when**: Undo executes exactly once. History array is never mutated in place. All tests pass.

---

### TASK-02: Fix Gmail sync upsert to preserve email status

**AC**: AC-3
**File**: `supabase/functions/gmail-sync/index.ts`

**Depends on**: None

**Problem**: The upsert at lines ~160-163 uses `supabase.from('emails').upsert(upsertRows, { onConflict: 'gmail_id' })`. This overwrites ALL columns including `status`, which is set to `'inbox'` by `transformEmail` (line ~317). When a user archives an email (`status: 'done'`) and then syncs, the upsert resets it to `'inbox'`.

**Implementation**:
1. Change the upsert to use Supabase's `ignoreDuplicates: false` with a raw SQL approach, OR
2. Split into two operations:
   - First: Try insert with `ignoreDuplicates: true` (only inserts new rows)
   - Second: Update existing rows with only the columns that should be refreshed (everything EXCEPT `status`)
3. Preferred approach: Use Supabase's upsert with `onConflict: 'gmail_id'` but modify the `upsertRows` for existing emails to exclude `status`. The simplest implementation:
   - Keep the upsert as-is but add a follow-up query that restores status for emails that already existed
   - OR use two separate operations: insert new (with `ignoreDuplicates: true`) and update existing (without `status` column)

**Recommended approach**: Replace the single upsert with:
```typescript
// 1. Insert only new emails (ignore conflicts)
const { error: insertError } = await supabase
  .from('emails')
  .upsert(upsertRows, { onConflict: 'gmail_id', ignoreDuplicates: true });

// 2. Update existing emails (refresh content, NOT status)
for (const row of upsertRows) {
  const { status, ...updateFields } = row;
  await supabase
    .from('emails')
    .update(updateFields)
    .eq('gmail_id', row.gmail_id)
    .eq('user_id', row.user_id);
}
```

Note: The loop is acceptable because sync fetches max 30 emails. If performance is a concern, batch with `.in('gmail_id', ids)` but that requires all rows to have the same update — which they don't (each has unique content).

**Test hooks**:
- Manual test: Archive an email → trigger sync → verify email does NOT reappear in inbox
- Manual test: Trash an email → trigger sync → verify email does NOT reappear in inbox
- Manual test: New email appears in inbox after sync (INSERT path works)
- Manual test: Existing email content updates after sync (UPDATE path works — e.g., is_read changes)

**Done when**: Archived/trashed emails persist their status across sync. New emails appear with `status: 'inbox'`.

---

### TASK-03: Wrap task store actions in queueOperation

**AC**: AC-1
**File**: `src/store/useTaskStore.ts`

**Depends on**: None (but largest task — start early)

**Problem**: 14 async actions call `supabase.from('tasks')` directly without try/catch. The `queueOperation` helper (lines ~133-158) exists and handles try/catch, offline queueing, and retry — but is never used.

**Implementation**:

For each of the following actions, wrap the Supabase call in `queueOperation`:

1. `addTask` (line ~325-337)
2. `restoreTask` (line ~351)
3. `batchAddTasks` (line ~405)
4. `updateTask` (line ~440)
5. `moveTask` (lines ~519-520)
6. `toggleImportance` (lines ~570-578)
7. `clearImportance` (lines ~608-611)
8. `changeParent` (line ~639)
9. `moveTaskTo` (line ~669)
10. `toggleTask` (line ~698)
11. `deleteTask` (line ~724)
12. `archiveTask` (line ~751)
13. `setPriority` (line ~778)
14. `toggleExpand` (line ~1029)

**Pattern for each action**:
```typescript
// Before (e.g., addTask):
await supabase.from('tasks').insert({ ...mapToDb(finalNewTask), user_id: userData.user.id });

// After:
await queueOperation(set, get,
  { type: 'insert', table: 'tasks', data: mapToDb(finalNewTask), taskId: finalNewTask.id },
  async () => {
    const { error } = await supabase.from('tasks').insert({ ...mapToDb(finalNewTask), user_id: userData.user.id });
    if (error) throw error;
  }
);
```

**Additional changes needed**:
- Each action must add a rollback toast on failure. The `queueOperation` catch block currently only logs and queues — add a toast: `toast('Failed to save. Will retry when online.')` for queued operations, or `toast('Action failed')` for non-recoverable errors.
- The `queueOperation` helper's `set` and `get` parameters need proper typing (see TASK-07, but do not block on it — use the existing `any` for now and TASK-07 will clean it up).

**Test hooks**:
- Unit test: Each action calls queueOperation (mock queueOperation, verify it's called)
- Unit test: When offline (`navigator.onLine = false`), operation is added to pendingOperations queue
- Unit test: When Supabase returns an error, operation is queued for retry
- Manual test: Create/edit/delete tasks with DevTools Network throttling set to Offline — verify operations queue and sync when back online

**Done when**: All 14 actions use queueOperation. No direct `supabase.from('tasks')` calls remain outside of queueOperation callbacks and fetchTasks.

---

### TASK-04: Add result.success checks to mail store GmailService calls

**AC**: AC-4
**File**: `src/store/useMailStore.ts`

**Depends on**: None

**Problem**: 5 out of 7 GmailService calls in useMailStore don't check `result.success`. The calls are inside try/catch, but GmailService returns `{ success: false, error }` on failure instead of throwing — so the catch block only handles network errors, not Gmail API errors.

**Implementation**:

For each of these 6 actions, add a `result.success` check after the GmailService call:
1. `archiveEmail` (line ~136)
2. `trashEmail` (line ~164)
3. `markAsRead` (line ~199)
4. `markAsUnread` (line ~228)
5. `addLabel` (line ~257)
6. `sendEmail` (line ~307) — handled separately in TASK-05

**Pattern**:
```typescript
// Before:
await GmailService.archive(previous.gmailId);

// After:
const result = await GmailService.archive(previous.gmailId);
if (!result.success) {
  throw new Error(result.error || 'Archive failed');
}
```

By throwing inside the existing try/catch, the catch block handles both network errors AND Gmail API errors with the same rollback + toast logic.

**Test hooks**:
- Unit test: When GmailService returns `{ success: false, error: 'Rate limited' }`, the optimistic update is rolled back
- Unit test: When GmailService returns `{ success: false }`, a toast is shown with error message
- Unit test: When GmailService returns `{ success: true }`, no rollback occurs

**Done when**: All 5 mail actions (excluding sendEmail) check `result.success` and throw on failure. Existing try/catch blocks handle the thrown error with rollback and toast.

---

### TASK-05: Add error handling to sendEmail

**AC**: AC-5
**Files**: `src/store/useMailStore.ts`, `src/components/Mail/ComposeModal.tsx`

**Depends on**: None

**Problem**: `sendEmail` (lines 307-309) is a bare `await GmailService.sendEmail(payload)` — no try/catch, no result check, no user feedback, no draft preservation.

**Implementation**:

1. In `useMailStore.ts`, update `sendEmail`:
```typescript
sendEmail: async (payload) => {
  const result = await GmailService.sendEmail(payload);
  if (!result.success) {
    throw new Error(result.error || 'Failed to send email');
  }
},
```

2. In `ComposeModal.tsx`, the caller of `sendEmail` must:
   - Wrap the call in try/catch
   - On success: close modal, show success toast, clear form
   - On failure: keep modal open (preserving draft), show error toast
   - During send: show a "Sending..." state (disable send button, show loading indicator)

**Test hooks**:
- Unit test: `sendEmail` throws when GmailService returns `{ success: false }`
- Manual test: Simulate send failure (disconnect network) — verify modal stays open with draft intact
- Manual test: Successful send — verify modal closes and toast shows "Email sent"

**Done when**: Send failures show a toast and preserve the user's draft. Send success closes the modal with confirmation.

---

### TASK-06: Create EmailContent component with Shadow DOM

**AC**: AC-6
**Files**: New `src/components/Mail/EmailContent.tsx`, modify `src/components/Mail/ThreadMessage.tsx`
**Reference**: [ADR-0001](../../architecture/adrs/adr-0001-email-css-isolation.md)

**Depends on**: None

**Implementation**:

1. Create `src/components/Mail/EmailContent.tsx`:
   ```typescript
   import { useRef, useEffect } from 'react';
   import DOMPurify from 'isomorphic-dompurify';

   interface EmailContentProps {
     html: string;
   }

   const BASE_STYLES = `
     :host {
       display: block;
       font-family: system-ui, -apple-system, sans-serif;
       font-size: 14px;
       line-height: 1.6;
       color: inherit;
       word-break: break-word;
     }
     a { color: #6366f1; }
     img { max-width: 100%; height: auto; }
     blockquote {
       border-left: 3px solid #e2e8f0;
       padding-left: 12px;
       margin-left: 0;
       color: #64748b;
     }
   `;

   export function EmailContent({ html }: EmailContentProps) {
     const containerRef = useRef<HTMLDivElement>(null);
     const shadowRef = useRef<ShadowRoot | null>(null);

     useEffect(() => {
       if (!containerRef.current) return;

       if (!shadowRef.current) {
         shadowRef.current = containerRef.current.attachShadow({ mode: 'open' });
       }

       const clean = DOMPurify.sanitize(html, {
         USE_PROFILES: { html: true },
         ADD_TAGS: ['style'],
         ADD_ATTR: ['target'],
       });

       shadowRef.current.innerHTML = `<style>${BASE_STYLES}</style>${clean}`;
     }, [html]);

     return <div ref={containerRef} />;
   }
   ```

2. Modify `ThreadMessage.tsx`:
   - Remove DOMPurify import (moved to EmailContent)
   - Remove `cleanHtml` computation
   - Replace `dangerouslySetInnerHTML` div with `<EmailContent html={email.payload?.body || ''} />`

**Test hooks**:
- Manual test: Open an email with `<style>body { background: red; }</style>` — verify FlowState background is NOT red
- Manual test: Open a newsletter email — verify it renders with formatting intact (tables, colors, images)
- Manual test: Links inside email content open in new tab
- Manual test: Text inside email content is selectable
- Manual test: Dark mode — verify email text inherits readable color

**Done when**: Email styles are fully isolated. No email CSS can affect the application. Email content still renders correctly.

---

### TASK-07: Replace `any` types with typed interfaces

**AC**: AC-7
**Files**: `src/store/useTaskStore.ts`, `src/store/useMailStore.ts`, `src/utils/supabase.ts`, `src/App.tsx`
**Depends on**: TASK-03 (task store changes), TASK-04 (mail store changes)

**Problem**: 15 occurrences of `any` across 4 files.

**Implementation**:

#### `src/store/useTaskStore.ts` (9 occurrences):

1. **Line 16** — `PendingOperation.data?: any` → `data?: Record<string, unknown>`
2. **Line 94** — `mapFromDb(dbTask: any)` → Define `DbTask` interface with all snake_case DB columns, use `mapFromDb(dbTask: DbTask)`
3. **Line 113** — `const dbObj: any = {}` → `const dbObj: Record<string, unknown> = {}`
4. **Lines 134-135** — `set: any, get: any` → Use Zustand's `StoreApi<TaskState>['setState']` and `StoreApi<TaskState>['getState']` (or inline the proper types from Zustand's generics)
5. **Line 137** — `executeOnline: () => Promise<any>` → `executeOnline: () => Promise<void>`
6. **Line 655** — `const update: any = { [field]: newOrder }` → `const update: Record<string, number | null> = { [field]: newOrder }`
7. **Line 665** — `const dbUpdate: any = { ...update }` → `const dbUpdate: Record<string, unknown> = { ...update }`
8. **Line 784** — `{} as any` in createSelectionSlice → Type the selection slice properly or use a typed empty object

#### `src/store/useMailStore.ts` (3 occurrences):

1. **Line 18** — `payload?: any` → Define `EmailPayload` interface:
   ```typescript
   interface EmailPayload {
     mimeType: string;
     body: string;
     to?: string;
     cc?: string;
     messageId?: string;
   }
   ```
2. **Line 322** — `(e: any)` in map callback → Define `DbEmail` interface with snake_case columns, use `(e: DbEmail)`
3. **Line 332** — `status: e.status as any` → Type `status` properly in `DbEmail` as `string`, and in `Email` as the union type it should be

#### `src/utils/supabase.ts` (2 occurrences):

1. **Lines 3-4** — `(import.meta as any).env` → Add a Vite env type declaration:
   ```typescript
   // src/vite-env.d.ts (or add to existing)
   interface ImportMetaEnv {
     readonly VITE_SUPABASE_URL: string;
     readonly VITE_SUPABASE_ANON_KEY: string;
     readonly VITE_GEMINI_API_KEY: string;
   }
   interface ImportMeta {
     readonly env: ImportMetaEnv;
   }
   ```
   Then change to `import.meta.env.VITE_SUPABASE_URL` (no cast).

#### `src/App.tsx` (1 occurrence):

1. **Line 23** — `useState<any>(null)` → Import `Session` from `@supabase/supabase-js` and use `useState<Session | null>(null)`

**Test hooks**:
- `npx tsc --noEmit` passes with zero errors
- `grep -r "any" src/store/useTaskStore.ts src/store/useMailStore.ts src/utils/supabase.ts src/App.tsx` returns zero type-annotation matches (excluding comments/strings)

**Done when**: All 15 `any` occurrences are replaced with proper types. TypeScript strict mode passes. No new `any` introduced.

---

## Execution Order

```
TASK-01 (undo fix)          ─┐
TASK-02 (sync status)        ├─ Can run in parallel (independent files)
TASK-03 (task error handling) ├─
TASK-04 (Gmail error checks)  ├─
TASK-05 (sendEmail errors)    ├─
TASK-06 (Shadow DOM)         ─┘
         │
         ▼
TASK-07 (type safety)       ── Runs last (depends on TASK-03 and TASK-04)
```

Tasks 01-06 are independent and can be executed in any order or in parallel. TASK-07 runs last because it touches files modified by TASK-03 and TASK-04.

Recommended serial order: TASK-01 → TASK-02 → TASK-03 → TASK-04 → TASK-05 → TASK-06 → TASK-07
