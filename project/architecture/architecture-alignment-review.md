# Architecture Alignment Review

> **Date**: 2026-02-08
> **Scope**: Comparison of the Architecture Overview against the actual codebase implementation
> **Purpose**: Identify areas where the implementation deviates from, undermines, or is not yet aligned with the architectural intent

---

## Summary

| Category | Aligned | Misaligned | Total Issues |
|----------|:-------:|:----------:|:------------:|
| State Management | Mostly | 4 issues | 4 |
| Service Layer | Mostly | 3 issues | 3 |
| Boundary Mapping | Partial | 3 issues | 3 |
| Error Handling | Partial | 3 issues | 3 |
| Offline Architecture | Partial | 2 issues | 2 |
| Security | Mostly | 2 issues | 2 |
| Component Structure | Mostly | 2 issues | 2 |
| **Total** | | | **19** |

---

## 1. State Management Misalignments

### 1.1 `useTaskStore` is a God Store (~1090 lines)

**Architecture says**: One store per domain, actions colocated with state.

**Reality**: `useTaskStore` is a monolithic store containing task CRUD, batch operations, hierarchy management, undo/redo history, offline queue, selection state, ordering logic, and guest mode — all in a single file. At ~1090 lines, it is the largest and most complex file in the codebase.

**Risk**: Difficult to reason about, test in isolation, or modify without unintended side effects. The `selectionSlice` extraction was a good start but only covers a small portion of the logic.

**Recommendation**: Extract into composable slices:
- `taskCrudSlice` — core add/update/delete/toggle
- `taskHistorySlice` — undo/redo command pattern
- `taskOfflineSlice` — pending operations queue
- `taskBatchSlice` — batch operations
- `taskOrderingSlice` — move, indent, outdent, importance

### 1.2 `any` Type Usage in Store Internals

**Architecture says**: No `any` types; use `unknown` and narrow, or define proper interfaces.

**Reality**: Several `any` casts exist in production code:
- `useTaskStore.ts:94` — `mapFromDb(dbTask: any)`
- `useTaskStore.ts:113` — `mapToDb` returns `any` object
- `useTaskStore.ts:133` — `queueOperation` takes `set: any, get: any`
- `useMailStore.ts:18` — `payload?: any` on Email interface
- `useMailStore.ts:322` — `(data || []).map((e: any) => ...)`
- `useMailStore.ts:332` — `status: e.status as any`
- `supabase.ts:4` — `(import.meta as any).env`
- `App.tsx:23` — `useState<any>(null)` for session

**Impact**: These defeat TypeScript's purpose and hide potential runtime errors, particularly in boundary mapping where type safety is most critical.

**Recommendation**: Define `DbTask`, `DbEmail`, and `SupabaseSession` interfaces. Type the Zustand `set`/`get` parameters properly using Zustand's built-in generic types.

### 1.3 History Commands Store Functions in Closures

**Architecture says**: Undo/redo via Command Pattern.

**Reality**: The command pattern is implemented but commands capture `get()` in closures that call store actions. The `undo` method in `useTaskStore` (line 1039-1063) has a bug: it calls `state.history.pop()` which mutates the Zustand state array directly, then attempts to redo the pop cleanly below — resulting in the undo executing twice (once on line 1044, again on line 1057).

**Impact**: Undo may produce inconsistent state. The double-execution of `command.undo()` could cause data corruption (e.g., deleting a task twice, or restoring a task that's already been restored).

**Recommendation**: Fix the undo implementation to use a single, clean array copy without mutation.

### 1.4 `useUIStore` Mixes Domain Concerns

**Architecture says**: `useUIStore` owns global UI state that doesn't belong to any domain store.

**Reality**: The store owns `isComposeOpen`, `replyMode`, and `forwardContext` — all of which are mail-specific state. These should live in `useMailStore` or a dedicated compose store.

**Recommendation**: Move mail-specific compose/reply state to `useMailStore` to maintain the "one store per domain" principle.

---

## 2. Service Layer Misalignments

### 2.1 Tasks Bypass the Service Layer Entirely

**Architecture says**: Service layer handles API communication.

**Reality**: `useTaskStore` calls `supabase.from('tasks')` directly — over 15 direct Supabase calls scattered throughout the store. There is no `TaskService` abstraction.

**Contrast**: Mail has a proper `GmailService` with named methods.

**Impact**: If the data access pattern changes (e.g., adding caching, request deduplication, or migration to a different backend), every call site in the store must be modified.

**Recommendation**: Extract a `TaskService` that mirrors the `GmailService` pattern — named methods returning typed responses, encapsulating all Supabase access.

### 2.2 Edge Function Is a Single Monolith

**Architecture says**: Edge Function handles Gmail sync and actions.

**Reality**: `gmail-sync/index.ts` is a single ~325-line file containing: routing, auth, sync, label management, email sending, and email transformation. All actions share one endpoint with an `action` field.

**Risk**: As more actions are added (search, attachment download, calendar sync), this file will grow without bound. It also makes error handling inconsistent — some actions return error responses while others throw.

**Recommendation**: Split into separate Edge Functions per action (or at minimum, separate handler files imported into the router).

### 2.3 GmailService Does Not Throw on Error

**Architecture says**: Never silently swallow errors.

**Reality**: `GmailService` methods return `{ success: false, error: message }` on failure — they never throw. The callers in `useMailStore` (e.g., `archiveEmail`) call these methods inside try/catch, but because the service returns errors as values rather than throwing, the catch blocks only handle unexpected failures (network errors from `supabase.functions.invoke`), not business logic errors from the Gmail API.

**Impact**: If Gmail returns a 403 or 404, the service returns `{ success: false }` and the store ignores it — no rollback, no toast, no error handling.

**Recommendation**: Either have `GmailService` throw on non-success responses (so store catch blocks work), or have the store check `result.success` after every call and rollback accordingly.

---

## 3. Boundary Mapping Misalignments

### 3.1 Inconsistent Mapping Strategy

**Architecture says**: Map once at the boundary; trust types downstream.

**Reality**:
- **Tasks**: Dedicated `mapFromDb` / `mapToDb` functions — well-structured.
- **Emails (client)**: Inline mapping in `fetchEmails` with loose `any` types — no reusable mapping function.
- **Emails (server)**: `transformEmail` in the Edge Function does Gmail-to-DB mapping — well-structured.
- **Missing**: No `mapEmailFromDb` function on the client side.

**Recommendation**: Extract `mapEmailFromDb` and `mapEmailToDb` as named functions in `useMailStore` (or a shared `src/utils/emailMapping.ts`), matching the task store pattern.

### 3.2 Email `status` Field Has Dual Ownership

**Architecture says**: One store owns each piece of state.

**Reality**: The `status` column on emails is set by:
1. The Edge Function during sync (always sets `'inbox'`)
2. The client store during archive/trash (`'done'`, `'trash'`)
3. The client store in `setEmailStatus` (arbitrary status)

The sync always resets status to `'inbox'` regardless of the current value, which means: if a user archives an email and then syncs, the email reappears in the inbox because the upsert overwrites the status.

**Impact**: Archived/trashed emails may reappear after sync. This is a data integrity issue.

**Recommendation**: The Edge Function should respect existing status during upsert (only set status to `'inbox'` for new rows, not updates), or the upsert should exclude the `status` column on conflict.

### 3.3 `transformEmail` Always Decodes Body Inline

**Architecture says**: Type and validate at the boundary.

**Reality**: The Edge Function's `transformEmail` (line 282-323) decodes base64 body content and stores the decoded HTML directly in the `payload.body` JSONB field. This means the database stores raw HTML from untrusted email content.

**Risk**: If a bug in DOMPurify or a change in rendering logic occurs, the raw HTML is permanently stored and cannot be re-sanitized without re-syncing from Gmail.

**Recommendation**: Store the original base64-encoded body and decode on the client side, or store both the raw and decoded versions.

---

## 4. Error Handling Misalignments

### 4.1 Task Store Actions Don't Await Consistently

**Architecture says**: Every async call must have try/catch with user feedback.

**Reality**: Most `useTaskStore` actions that write to Supabase do NOT have try/catch:
- `addTask` (line 325-337): `await supabase.from('tasks').insert(...)` — no catch, no rollback
- `updateTask` (line 440): `await supabase.from('tasks').update(...)` — no catch, no rollback
- `toggleTask` (line 698): no catch
- `deleteTask` (line 724): no catch
- `archiveTask` (line 751): no catch
- `setPriority` (line 778): no catch

Only the `queueOperation` helper has try/catch, and it's only used in some code paths.

**Contrast**: `useMailStore` actions (archive, trash, markAsRead, markAsUnread, addLabel) all have proper try/catch with rollback and toast — these are well-aligned.

**Impact**: If a task write fails, the UI shows the optimistic update but the data is silently lost. The user believes the change was saved when it wasn't.

**Recommendation**: Wrap all task store DB operations in `queueOperation` (which already handles try/catch and offline queueing) or add explicit try/catch with rollback.

### 4.2 `sendEmail` Has No Error Handling

**Architecture says**: Optimistic send with rollback.

**Reality**: `useMailStore.sendEmail` (line 307-309) is:
```typescript
sendEmail: async (payload) => {
    await GmailService.sendEmail(payload);
}
```

No try/catch. No optimistic "Sending..." state. No rollback. No toast on failure. If the network fails mid-send, the promise rejects and the error propagates to the caller — but the `ComposeModal` may or may not handle it.

**Recommendation**: Add try/catch, toast on failure, and consider the optimistic send pattern from the PRD.

### 4.3 Coach Store Has No Error Recovery

**Architecture says**: Surface errors to the user.

**Reality**: `useCoachStore` has `setError` and `setLoading` actions, but the actual Gemini API call is in `CoachChat.tsx`, not in the store. If the call fails, it depends entirely on the component implementation. The store has no retry logic or error recovery pattern.

**Impact**: Low severity for now (coach is non-critical), but inconsistent with the architectural pattern.

---

## 5. Offline Architecture Misalignments

### 5.1 Mail Module Has No Offline Queue

**Architecture says**: Offline support is a core architectural pillar; operations queue and sync.

**Reality**: The task module has a full offline queue. The mail module has none. If the user archives an email while offline, the optimistic update shows it as archived, but no operation is queued. When the user refreshes, the email reappears as unarchived.

**Impact**: Users in flaky network conditions may lose mail triage work.

**Recommendation**: Extend the `PendingOperation` queue pattern to the mail module, or at minimum document this as a known limitation.

### 5.2 Offline Detection Is Naive

**Architecture says**: Must not lose user data offline.

**Reality**: `useOnlineStatus` uses `navigator.onLine` and browser online/offline events. This detects hard disconnects but NOT "lie-fi" (connected to WiFi but no internet).

**Impact**: In lie-fi situations, the app thinks it's online, attempts API calls, and they fail. For tasks, `queueOperation` catches these failures. For mail, there's no fallback.

**Recommendation**: Consider adding a heartbeat check (periodic fetch to a known endpoint) for more robust connectivity detection, or document the lie-fi limitation.

---

## 6. Security Misalignments

### 6.1 Gemini API Key Exposed Client-Side

**Architecture says**: All sensitive keys in `.env.local` or environment variables.

**Reality**: The Gemini API key is stored in `VITE_GEMINI_API_KEY` and shipped to the client in the built JavaScript bundle. Anyone can extract it from the browser's Network tab or the JS source.

**Risk**: The key could be used to make Gemini API calls at the user's (or project's) expense. Gemini keys may have usage quotas, but this is still a billing risk.

**Mitigation**: The architecture overview notes this is acceptable because the key has no access to user data. This is true, but the billing risk should be explicitly acknowledged and rate-limiting should be considered.

### 6.2 Email HTML Rendering Has No CSS Scoping

**Architecture says**: DOMPurify sanitization before `dangerouslySetInnerHTML`.

**Reality**: Email HTML is sanitized by DOMPurify (good), but rendered directly into the React component tree with no CSS scoping. Email styles (`<style>` tags, which are explicitly allowed via `ADD_TAGS: ['style']`) can leak into and break the application's layout.

**Impact**: A malicious or poorly-formatted email could override FlowState's Tailwind styles, potentially breaking the entire UI.

**Recommendation**: Use Shadow DOM or an `<iframe>` with `srcdoc` to isolate email content. Remove `'style'` from `ADD_TAGS` until scoping is implemented.

---

## 7. Component Structure Misalignments

### 7.1 `useHotkeys` Is a God Hook (~400 lines)

**Architecture says**: One hook per concern; split by domain.

**Reality**: `useHotkeys.ts` handles ALL keyboard shortcuts for ALL views in a single 400-line `useEffect`. It imports from 4 stores and handles: global shortcuts, task view shortcuts, mail view shortcuts, G-chord navigation, and modal escape handling.

**Recommendation**: Split into:
- `useGlobalHotkeys` — escape, ?, Cmd+K, Cmd+Z, G-chords, view switching
- `useTaskHotkeys` — task-view-specific keys (delegated further to `useTaskListKeyboard`)
- `useMailHotkeys` — mail-view-specific keys

### 7.2 `App.tsx` Owns Too Much State

**Architecture says**: Push store subscriptions down to leaf components.

**Reality**: `App.tsx` destructures 15+ fields from `useUIStore` and several from `useTaskStore`. It handles auth, session management, Inbox Zero calculation, data fetching, online/offline sync, and view routing.

**Impact**: Any change to any of these store fields causes a full re-render of the App component and its entire subtree.

**Recommendation**: Extract auth logic into a `useAuth` hook, move Inbox Zero calculation into `InboxZero` component, push modal open/close state down to individual modal components that subscribe to their own slice of UIStore.

---

## Priority Ranking

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| **P0** | 4.1 Task store actions missing try/catch (data loss risk) | Medium | Critical |
| **P0** | 1.3 Undo double-execution bug | Low | Critical |
| **P0** | 3.2 Email status overwritten on sync | Low | High |
| **P1** | 2.3 GmailService errors not handled by store | Low | High |
| **P1** | 6.2 Email CSS can break app layout | Medium | High |
| **P1** | 4.2 sendEmail has no error handling | Low | Medium |
| **P1** | 1.2 `any` types throughout stores | Medium | Medium |
| **P2** | 1.1 useTaskStore is a God Store | High | Medium |
| **P2** | 2.1 No TaskService abstraction | Medium | Medium |
| **P2** | 7.1 useHotkeys is a God Hook | Medium | Medium |
| **P2** | 3.1 Inconsistent email boundary mapping | Low | Low |
| **P2** | 1.4 Compose state in wrong store | Low | Low |
| **P2** | 7.2 App.tsx over-subscribing | Medium | Low |
| **P3** | 5.1 Mail has no offline queue | High | Medium |
| **P3** | 2.2 Edge Function is monolith | Medium | Low |
| **P3** | 5.2 Naive offline detection | Medium | Low |
| **P3** | 6.1 Gemini API key billing risk | Low | Low |
| **P3** | 3.3 Decoded HTML stored in DB | Low | Low |
| **P3** | 4.3 Coach store error handling | Low | Low |

---

*This review should be used as input for sprint planning. P0 items represent data integrity risks and should be addressed before new feature development.*
