# FlowState — Architecture Overview

> **Version**: 1.0
> **Last updated**: 2026-02-08
> **Status**: Documents the architecture as-built, with prescriptive guidance for future modules.

---

## 1. System Context

FlowState is a single-page application (SPA) that runs entirely in the browser. It communicates with two backend systems and one AI service:

```
+-------------------+       +-------------------+       +-------------------+
|                   |       |                   |       |                   |
|   React Client    |<----->|     Supabase      |<----->|    Gmail API      |
|   (Browser SPA)   |       |  (Auth, DB, Edge) |       |  (Google Cloud)   |
|                   |       |                   |       |                   |
+-------------------+       +-------------------+       +-------------------+
        |
        |  Direct API call (client-side key)
        v
+-------------------+
|   Google Gemini   |
|   (AI Coach)      |
+-------------------+
```

**Key constraint**: The client NEVER holds Google OAuth refresh tokens. All Gmail API calls are proxied through a Supabase Edge Function that exchanges a stored refresh token for a short-lived access token server-side.

**Exception**: Gemini API calls are made directly from the client using a client-side API key. This is acceptable because the Gemini key has no access to user data — it only provides AI completions.

---

## 2. High-Level Architecture

### 2.1 Layers

```
+================================================================+
|                        UI Layer                                 |
|  React 19 components, Framer Motion animations, Tailwind CSS   |
+================================================================+
|                     State Layer                                 |
|  Zustand stores (Task, Mail, UI, Coach)                        |
|  Persist middleware (localStorage), Devtools middleware          |
+================================================================+
|                    Service Layer                                |
|  GmailService (Edge Function proxy)                            |
|  Supabase client (direct DB access with RLS)                   |
|  Gemini client (direct AI API)                                 |
+================================================================+
|                   Infrastructure Layer                          |
|  Supabase: PostgreSQL + Auth + Edge Functions + RLS            |
|  Google: Gmail API + Gemini API + OAuth 2.0                    |
+================================================================+
```

### 2.2 Module Structure

The application is organized into **domain modules**, each with its own store, components, and (where applicable) service:

| Module | Store | Service | Components | Description |
|--------|-------|---------|------------|-------------|
| **Tasks** | `useTaskStore` | Supabase (direct) | `TaskList/`, `QuickAdd`, `WeeklyReview`, `InboxZero` | Hierarchical task CRUD, offline sync, undo/redo |
| **Mail** | `useMailStore` | `GmailService` | `Mail/` (6 components) | Gmail triage, threading, compose, labels |
| **Coach** | `useCoachStore` | `gemini.ts` | `CoachChat` | AI weekly review conversations |
| **UI** | `useUIStore` | — | `TopNav`, `ShortcutsModal`, `CommandPalette` | Global UI state: filters, modals, focus mode, view routing |

### 2.3 Cross-Cutting Concerns

| Concern | Implementation | Location |
|---------|---------------|----------|
| **Keyboard shortcuts** | Centralized hook + hotkey registry | `useHotkeys.ts`, `hotkeys.ts` |
| **Online/offline detection** | Browser event listener hook | `useOnlineStatus.ts` |
| **Authentication** | Supabase Auth with Google OAuth | `supabase.ts`, `App.tsx` |
| **Routing** | State-driven view switching (not URL-based) | `useUIStore.currentView` |
| **Toasts/Feedback** | Custom toast system | `Toaster.tsx` |
| **Error boundaries** | React error boundary wrapper | `ErrorBoundary.tsx` |

---

## 3. State Management Architecture

### 3.1 Store Design Principles

1. **One store per domain** — Tasks, Mail, Coach, and UI each own their state. No cross-store state duplication.
2. **Granular selectors** — Components subscribe to individual fields, never destructure the whole store.
3. **Actions colocated with state** — Each store defines its own async actions (no separate action files).
4. **Persist selectively** — Only essential data is persisted to localStorage. Transient UI state (loading, error) is excluded.

### 3.2 Store Inventory

#### `useTaskStore` (Zustand + persist middleware)

- **Primary entity**: `Task[]`
- **Persisted**: tasks, pendingOperations, lastSyncedAt, guestMode
- **Patterns**: Optimistic updates with offline queue, Command Pattern undo/redo (max 50 history)
- **Boundary mapping**: `mapFromDb` / `mapToDb` for snake_case (DB) to camelCase (TS) conversion
- **Slice composition**: Selection logic extracted to `slices/selectionSlice.ts`

#### `useMailStore` (Zustand + devtools middleware)

- **Primary entity**: `Email[]`
- **Persisted**: No (emails are re-fetched from DB on load)
- **Patterns**: Optimistic updates with rollback on failure, tab-based filtering
- **Boundary mapping**: Inline mapping in `fetchEmails` action
- **Notable**: Maintains `tabHistory` to remember last-selected email per tab

#### `useUIStore` (Zustand, no middleware)

- **Purpose**: Global UI state that doesn't belong to any domain store
- **Owns**: Current view, active filter, modal states, focus mode, compose state, reply mode, forward context
- **Persisted**: No

#### `useCoachStore` (Zustand + persist middleware)

- **Purpose**: AI coach conversation state and user profile
- **Persisted**: User profile/goals and conversation history (keyed by ISO week)

### 3.3 Data Flow Pattern

All data mutations follow this pattern:

```
User Action
  -> Store Action (optimistic local state update)
  -> Service Call (async, in background)
    -> Success: update lastSyncedAt
    -> Failure: rollback local state + show toast
```

For tasks specifically, an offline queue adds a fallback:

```
User Action
  -> Store Action (optimistic local state update)
  -> If online: Service Call
    -> Success: update lastSyncedAt
    -> Failure: queue PendingOperation
  -> If offline: queue PendingOperation immediately
  -> On reconnect: process pending operations sequentially
```

---

## 4. Service Layer Architecture

### 4.1 Gmail Integration (Server-Proxied)

```
Client                    Edge Function              Gmail API
  |                           |                         |
  |-- invoke('gmail-sync') -->|                         |
  |   { action: 'sync' }     |-- getAccessToken() ---->|
  |                           |   (refresh_token from   |
  |                           |    google_tokens table)  |
  |                           |<-- access_token --------|
  |                           |                         |
  |                           |-- messages.list ------->|
  |                           |<-- message data --------|
  |                           |                         |
  |                           |-- upsert to emails ---->|
  |<-- { success, count } ----|   (Supabase DB)         |
```

**Actions supported by the Edge Function**:

| Action | Gmail API Call | Purpose |
|--------|---------------|---------|
| `sync` | `messages.list` + `messages.get` (parallel) | Fetch latest 30 messages from INBOX + custom labels |
| `archive` | `messages.modify` (remove INBOX) | Archive email |
| `read` | `messages.modify` (remove UNREAD) | Mark as read |
| `modify` | `messages.modify` (add/remove labels) | Generic label operations, including custom FLOWSTATE/* labels |
| `send-email` | `messages.send` (RFC 2822 MIME) | Compose and send (with threading support) |

**Security model**: The Edge Function validates the Supabase JWT, retrieves the user's Google refresh token from the `google_tokens` table, and exchanges it for a short-lived access token. The client never sees Google credentials.

### 4.2 Supabase Direct Access (Tasks)

Tasks use the Supabase client directly (no Edge Function proxy) because:
- No external API is involved — it's just PostgreSQL CRUD
- RLS policies enforce `user_id = auth.uid()` — the client can only access its own rows
- Offline queue handles network failures

### 4.3 Gemini AI (Direct Client Call)

The AI Coach calls the Gemini API directly from the browser:
- Uses `@google/generative-ai` SDK with a client-side API key
- Sends completed task summaries and optional calendar screenshots as context
- Receives coaching responses in a chat-style conversation
- No sensitive user data flows through this path — only task titles and user-authored goals

---

## 5. Database Schema

### 5.1 Tables

#### `tasks`

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (PK) | Client-generated |
| `user_id` | uuid (FK -> auth.users) | RLS enforcement |
| `parent_id` | text (nullable, self-FK) | Hierarchical nesting |
| `title` | text | |
| `notes` | text (nullable) | Markdown content |
| `completed` | boolean | |
| `completed_at` | timestamptz (nullable) | |
| `priority` | integer (1-4) | 1=High, 4=None |
| `tags` | text[] | Array of tag strings |
| `due_date` | timestamptz (nullable) | |
| `created_at` | bigint | Epoch milliseconds |
| `order` | float | Fractional ordering (spacing: 1000) |
| `expanded` | boolean | UI state (persisted for consistency across devices) |
| `archived` | boolean | |
| `important_order` | float (nullable) | Ordering within "Important" section of Today view |
| `today_order` | float (nullable) | Ordering within Today view (decoupled from hierarchy) |

#### `emails`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK, auto) | |
| `user_id` | uuid (FK -> auth.users) | RLS enforcement |
| `gmail_id` | text (unique) | Gmail message ID, used for upsert conflict resolution |
| `thread_id` | text | Gmail thread ID for grouping |
| `history_id` | text (nullable) | Gmail history ID for incremental sync (not yet used) |
| `internal_date` | bigint | Gmail internal date (epoch ms) |
| `subject` | text | |
| `snippet` | text | |
| `sender_name` | text | |
| `sender_email` | text | |
| `payload` | jsonb | Structured data: mimeType, body (decoded HTML), to, cc, messageId |
| `status` | text | Enum: `inbox`, `to_read`, `to_reply`, `done`, `trash` |
| `is_read` | boolean | |
| `labels` | text[] | Gmail label IDs (INBOX, UNREAD, CATEGORY_*, FLOWSTATE/*) |
| `created_at` | timestamptz (auto) | |
| `updated_at` | timestamptz (auto) | |

#### `google_tokens`

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | uuid (PK, FK -> auth.users) | One token per user |
| `refresh_token` | text | Google OAuth refresh token (encrypted at rest by Supabase) |
| `updated_at` | timestamptz | Last token refresh |

### 5.2 Row-Level Security

All tables enforce RLS with the policy: `auth.uid() = user_id`. Users can only read and write their own rows.

### 5.3 Boundary Mapping Convention

Database columns use `snake_case`. TypeScript fields use `camelCase`. The boundary is crossed exactly once, in dedicated mapping functions:

- **Tasks**: `mapFromDb()` and `mapToDb()` in `useTaskStore.ts`
- **Emails**: Inline mapping in `useMailStore.fetchEmails()` and `transformEmail()` in the Edge Function

---

## 6. UI Architecture

### 6.1 View Routing

FlowState does **not** use URL-based routing. Views are driven by `useUIStore.currentView` (`'tasks' | 'mail'`), with Framer Motion `AnimatePresence` handling transitions.

**Rationale**: URL routing adds complexity (history management, deep links, URL sync) that provides no value for a single-user focus tool where the user always starts at their default view. State-driven routing keeps the architecture simpler and transitions smoother.

**Trade-off**: No deep-linkable URLs, no browser back/forward navigation between views. Acceptable for the target persona.

### 6.2 Component Organization

```
src/components/
  App.tsx                    # Root: auth, view routing, modal orchestration
  TopNav.tsx                 # Navigation bar, view tabs, sync status
  Login.tsx                  # Auth screen

  TaskList.tsx               # Task list container (DND, filtering)
  TaskList/
    TaskItem.tsx             # Individual task row
    InlineEdit.tsx           # Task title inline editing
    useTaskListKeyboard.ts   # Vim-style keyboard navigation for tasks
    useTaskListDnd.ts        # Drag-and-drop sensors and handlers
    useVisibleTasks.ts       # Filtered, sorted, flattened task list (memoized)

  Mail/
    MailView.tsx             # Mail module entry point (sync trigger)
    MailSplitView.tsx        # Split pane layout with animated reading pane
    ThreadList.tsx           # Email thread list (horizontal rows)
    ReadingPane.tsx          # Thread view with sanitized HTML
    ThreadMessage.tsx        # Individual message in thread
    InlineReply.tsx          # Reply textarea at bottom of reading pane
    ComposeModal.tsx         # New email/forward modal
    ContactAutocomplete.tsx  # Recipient field autocomplete

  WeeklyReview.tsx           # Completed tasks grouped by week
  CoachChat.tsx              # AI coach chat interface
  QuickAdd.tsx               # Floating task input
  CommandPalette.tsx         # Cmd+K command search
  ShortcutsModal.tsx         # Keyboard shortcuts help
  InboxZero.tsx              # Celebration animation
  Toaster.tsx                # Toast notification system
  ErrorBoundary.tsx          # React error boundary
  SectionHeader.tsx          # Collapsible section header (reusable)
  SortableTaskItem.tsx       # DND wrapper for TaskItem
```

### 6.3 Animation Strategy

- **Library**: Framer Motion
- **View transitions**: Spring physics (`stiffness: 300, damping: 30`) for module switching
- **Split pane**: Reading pane slides in/out with spring animation; thread list width animates between full-width and fixed 450px
- **Task operations**: Completion checkmark, archive slide-out

---

## 7. Keyboard Architecture

### 7.1 Centralized Registry

All keyboard shortcuts are defined in `src/utils/hotkeys.ts` as a typed array of `Hotkey` objects. This serves as the single source of truth used by:

- `ShortcutsModal` — displays bindings to the user
- `CommandPalette` — shows shortcuts inline with actions
- `useHotkeys` — references for documentation (actual handling is procedural)

### 7.2 Event Handling Strategy

A single global `keydown` listener in `useHotkeys.ts` handles all shortcuts:

1. **Input guard**: If focus is on INPUT, TEXTAREA, or BUTTON — ignore all keys except Escape
2. **Modal override**: If compose modal or inline reply is active — bail out (those manage their own keys)
3. **Global shortcuts**: ?, Escape, Cmd+K, Cmd+Z, Cmd+Arrow, Cmd+Shift+V
4. **G-chord navigation**: Two-key sequence with 500ms timeout window
5. **View-scoped shortcuts**: Task-specific or Mail-specific based on `currentView`

**State access pattern**: The handler reads latest state via `useXxxStore.getState()` (not closure values) to avoid stale closure bugs.

### 7.3 Keyboard Scoping

| Scope | Active When | Examples |
|-------|-------------|---------|
| **Global** | Always (except input fields) | ?, Escape, Cmd+K, Cmd+Z, g-chords |
| **Tasks view** | `currentView === 'tasks'` | Enter (new task), PgUp/PgDn (filter cycle) |
| **Task focused** | A task is selected | e (edit), x (complete), d (set date) |
| **Mail view** | `currentView === 'mail'` | e (archive), r (reply), c (compose) |

---

## 8. Authentication & Security

### 8.1 Auth Flow

1. User clicks "Sign in with Google" -> Supabase Auth initiates Google OAuth
2. Google returns tokens to Supabase; Supabase creates a session
3. On `SIGNED_IN` event, if `provider_refresh_token` is present, it's stored in `google_tokens` table
4. Subsequent Gmail API calls: Edge Function reads refresh token from `google_tokens`, exchanges for access token

### 8.2 Security Boundaries

| Boundary | Protection |
|----------|-----------|
| **Database access** | RLS policies: `auth.uid() = user_id` on all tables |
| **Gmail API access** | Refresh tokens stored server-side; Edge Function validates JWT before use |
| **Email content rendering** | DOMPurify sanitization before `dangerouslySetInnerHTML` |
| **Environment secrets** | `.env.local` for client-side keys; Deno environment variables for Edge Function secrets |
| **CORS** | Edge Function sets permissive CORS headers (acceptable for Supabase function invocation) |

### 8.3 Guest Mode

Guest mode bypasses Supabase entirely:
- Tasks are stored only in localStorage (via Zustand persist)
- No network calls for CRUD operations
- Mail module is not available in guest mode
- Provides a zero-friction trial experience

---

## 9. Offline Architecture

### 9.1 Detection

`useOnlineStatus` hook listens to browser `online`/`offline` events and exposes a reactive boolean.

### 9.2 Queue Pattern (Tasks Only)

```typescript
interface PendingOperation {
  id: string;
  type: 'insert' | 'update' | 'delete';
  table: string;
  data?: Record<string, unknown>;
  taskId?: string;
}
```

Operations are queued when:
- `navigator.onLine` is false at time of action
- A network request fails (queued for retry)

Operations are processed when:
- Online status changes to `true`
- App component detects `isOnline && pendingCount > 0`

Processing is sequential — each operation is retried individually. Failed operations remain in the queue.

### 9.3 Mail Offline Limitations

The mail module does **not** have an offline queue. All mail actions (archive, label, send) require an active network connection. Optimistic UI updates roll back on failure, but operations are not queued for retry.

---

## 10. Prescriptive Rules for New Modules

When adding future modules (Calendar, Chat, Workspace), follow these established patterns:

### 10.1 Store Pattern

- Create `useXxxStore` with Zustand
- Use `persist` middleware if data should survive page reload; `devtools` for debugging
- Define a typed interface for all state + actions
- Implement boundary mapping functions (`mapFromDb` / `mapToDb`) for any DB-backed entities
- Follow the optimistic update + rollback pattern for all mutations

### 10.2 Service Pattern

- If the module integrates with an external API requiring secrets: create a Supabase Edge Function
- If the module only accesses Supabase tables: use the Supabase client directly with RLS
- Service functions return typed response objects, never raw HTTP responses

### 10.3 Component Pattern

- Group module components in `src/components/ModuleName/`
- Entry point component named `ModuleNameView.tsx`
- Keep components under 150 lines; extract hooks for data fetching and keyboard handling
- Handle all four states: loading, error, empty, loaded

### 10.4 Keyboard Pattern

- Add new hotkeys to the `HOTKEYS` array in `hotkeys.ts`
- Add handlers in the appropriate view scope within `useHotkeys.ts`
- Follow the existing category system: navigation, creation, organization, editing, view

### 10.5 Database Pattern

- All tables must have `user_id` column with FK to `auth.users`
- All tables must have RLS enabled with `auth.uid() = user_id` policy
- Use `snake_case` for columns; map to `camelCase` at the boundary
- Use upsert with unique constraints for external data (e.g., `gmail_id` for emails)

---

*This document describes the system as built and prescribes patterns for extension. Changes to the architecture require an ADR.*
