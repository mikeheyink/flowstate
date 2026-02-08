# FlowState — Product Requirements Document

> **Version**: 1.0
> **Last updated**: 2026-02-08
> **Next Feature ID**: FEATURE-00009

---

## Vision

**FlowState is a Focus Operating System** — a single, keyboard-driven workspace that consolidates the core workflows of knowledge work (tasks, email, and eventually calendar, chat, and research) so that high-output professionals can protect their attention and do their best work without context-switching between apps.

The product philosophy rests on five pillars:

| Principle | Description |
|-----------|-------------|
| **Keyboard First** | Every action achievable via keyboard in < 100ms. The mouse is optional. |
| **Zero Context Switch** | One environment for all work modules, with unified shortcuts and navigation. |
| **Focus by Default** | No notifications, no distractions, no infinite scroll. Intentional interaction only. |
| **AI-Augmented** | Intelligence that helps users reflect and improve — not replace thinking. |
| **Speed is UX** | Sub-100ms response time for all client-side interactions. If the user waits, flow is broken. |

---

## Target Users

**Primary persona**: High-output knowledge workers (developers, designers, founders, executives) who:

- Spend 6+ hours daily in digital work environments
- Are frustrated by tab chaos and constant app-switching (email, tasks, calendar, chat)
- Value keyboard efficiency over mouse clicking
- Want to protect their attention from notification culture
- Believe in systematic productivity and regular reflection

**Pain points we solve**:

1. **Tab sprawl** — 30+ browser tabs create cognitive overhead
2. **App switching** — Email to Slack to Calendar to ToDo wastes mental energy
3. **Notification fatigue** — Every app demands attention, none respect focus
4. **Tool fragmentation** — Tasks in one app, context in another, nothing connected
5. **No reflection** — Work happens but learning and improvement don't

---

## Non-Goals

These are explicitly out of scope for FlowState:

- **General-purpose project management** — We are not Jira, Asana, or Linear. FlowState is a personal productivity tool, not a team collaboration platform.
- **Social/collaborative features** — No shared boards, no comments from teammates, no @mentions. This is a single-player focus tool.
- **Rich text / document editing** — We are not Notion or Google Docs. Task notes support markdown; that's the ceiling.
- **Mobile app** — The product is desktop-first, keyboard-first. A responsive mobile web view exists for quick capture only.
- **Notification system** — No push notifications, no badges, no "you have X unread" nagging. The user checks FlowState when they choose to.

---

## Constraints

| Constraint | Detail |
|------------|--------|
| **Auth provider** | Supabase Auth with Google OAuth (provides Gmail + Calendar token in one flow) |
| **Backend** | Supabase (PostgreSQL + Edge Functions + RLS). No custom backend server. |
| **AI provider** | Google Gemini API for the AI Coach |
| **Email provider** | Gmail API only (no IMAP/SMTP generic support) |
| **Deployment** | Static SPA (Vite build) — hostable on any CDN |
| **Browser support** | Modern evergreen browsers (Chrome, Firefox, Safari, Edge) |
| **Offline** | Must not lose user data. Operations queue offline and sync when reconnected. |

---

## Feature Index

| Feature ID | Name | Module | Status |
|------------|------|--------|--------|
| FEATURE-00001 | [Hierarchical Task Management](#feature-00001-hierarchical-task-management) | Tasks | Implemented |
| FEATURE-00002 | [Smart Views & Triage](#feature-00002-smart-views--triage) | Tasks | Implemented |
| FEATURE-00003 | [AI Coach (Weekly Review)](#feature-00003-ai-coach-weekly-review) | Tasks | Implemented |
| FEATURE-00004 | [Keyboard-First Navigation](#feature-00004-keyboard-first-navigation) | Global | Implemented |
| FEATURE-00005 | [Mail Client — Reading & Triage](#feature-00005-mail-client--reading--triage) | Mail | Partially Implemented |
| FEATURE-00006 | [Mail Client — Compose & Reply](#feature-00006-mail-client--compose--reply) | Mail | Partially Implemented |
| FEATURE-00007 | [Offline Support & Data Reliability](#feature-00007-offline-support--data-reliability) | Core | Implemented |
| FEATURE-00008 | [Platform Reliability & Data Integrity](features/feature-00008.md) | Core | Implemented |

---

## Feature Details

### FEATURE-00001: Hierarchical Task Management

**Problem**: Knowledge workers need to capture, organize, and complete tasks quickly — with support for projects (parent/child hierarchy) and flexible prioritization.

**User stories**:
- As a user, I want to capture a task in < 2 seconds (Enter, type, Enter)
- As a user, I want to break large tasks into subtasks (indent/outdent via Tab/Shift+Tab, unlimited depth)
- As a user, I want to set priorities (P1-P4), due dates (natural language: "tomorrow", "next Friday"), and tags (#project, @context)
- As a user, I want to reorder tasks via keyboard (Ctrl+Arrow) or drag-and-drop
- As a user, I want to multi-select tasks (Shift+Arrow) and batch-operate on them
- As a user, I want to add markdown notes to any task for extra context
- As a user, I want batch-paste (Cmd+Shift+V) to create multiple tasks from clipboard lines

**Acceptance criteria**:
- Task CRUD with optimistic updates and rollback on failure
- Hierarchical parent/child relationships with expand/collapse
- Priority levels visually indicated, affecting sort order
- Due dates parsed from natural language via chrono-node
- Tags extracted from task title (# and @ prefixes)
- Drag-and-drop reordering via @dnd-kit
- Keyboard reordering (Ctrl+Up/Down)
- Multi-select with Shift+Arrow keys
- Markdown notes field per task
- Batch task creation from clipboard

**Status**: Implemented

---

### FEATURE-00002: Smart Views & Triage

**Problem**: A flat list of tasks is overwhelming. Users need filtered views that answer "what should I work on right now?" and a satisfying "inbox zero" moment.

**User stories**:
- As a user, I want an Inbox (Plan) view showing all active, non-archived tasks
- As a user, I want a Today view showing tasks due today or manually starred for today
- As a user, I want an Upcoming view showing future tasks grouped by time horizon
- As a user, I want a Review view showing completed tasks grouped by ISO week
- As a user, I want an Inbox Zero celebration when a view is cleared
- As a user, I want to cycle between views via PgUp/PgDn or G-chord navigation (g+i, g+t, g+r)

**Acceptance criteria**:
- Four views: Inbox (active), Today (due today + todayOrder set), Upcoming (future due dates grouped), Review (completed by week)
- Inbox Zero animation (confetti) when Inbox or Today view reaches zero items
- View cycling via PgUp/PgDn keyboard shortcuts
- G-chord navigation: g then i (Inbox), g then t (Today), g then r (Review)
- Each view applies its own sort and group logic

**Status**: Implemented

---

### FEATURE-00003: AI Coach (Weekly Review)

**Problem**: Users complete tasks but rarely reflect on what they accomplished or how to improve. They need a conversational review partner.

**User stories**:
- As a user, I want an AI coach that can see my completed tasks for the week and discuss patterns
- As a user, I want to paste calendar screenshots and have the coach analyze my time allocation
- As a user, I want the coach to remember my goals and profile across sessions
- As a user, I want the coach to give actionable, personalized advice — not generic platitudes

**Acceptance criteria**:
- Chat interface (CoachChat component) powered by Google Gemini API
- Coach receives completed tasks as context
- Image upload support (calendar screenshots) for multimodal analysis
- User profile/goals stored in CoachStore and passed as system context
- Conversation persisted across the session

**Status**: Implemented

---

### FEATURE-00004: Keyboard-First Navigation

**Problem**: Mouse-driven interfaces break flow. Every interaction should be achievable from the keyboard with discoverable shortcuts.

**User stories**:
- As a user, I want all actions accessible via keyboard shortcuts
- As a user, I want a shortcuts modal (?) showing all available bindings
- As a user, I want a command palette (Cmd+K) for discovering and executing actions by name
- As a user, I want G-chord navigation for cross-module movement (g+m for Mail, g+t for Tasks)
- As a user, I want Cmd+Arrow to switch between modules (Tasks, Mail)
- As a user, I want Undo (Cmd+Z) and Redo (Cmd+Shift+Z) for any destructive action

**Acceptance criteria**:
- Centralized hotkey registry (src/utils/hotkeys.ts) as single source of truth
- Global hotkey handler (useHotkeys hook) with proper modal/input override logic
- Shortcuts modal showing all bindings grouped by category
- Command palette with fuzzy search over available actions
- G-chord navigation with 500ms timeout window
- Module switching via Cmd+Left/Right arrows
- Full undo/redo stack via command pattern in task store
- Context-aware shortcuts (task-focused actions only available when a task is selected)

**Status**: Implemented

---

### FEATURE-00005: Mail Client — Reading & Triage

**Problem**: Email is the #1 source of context-switching. Users need to process their inbox with keyboard-driven speed inside FlowState, without opening Gmail.

**User stories**:
- As a user, I want to see my Gmail inbox inside FlowState with full-width thread list
- As a user, I want to navigate emails with Arrow keys, open with Enter, close with Escape
- As a user, I want a split-view reading pane that slides in when I open a thread
- As a user, I want to archive emails with `e`, trash with `#`, and auto-advance to next
- As a user, I want to mark emails as unread (`u`) or read (`Shift+I`)
- As a user, I want to defer emails: "To Read" (`Shift+R`) and "To Reply" (`Shift+Y`) using real Gmail labels
- As a user, I want tab-based organization: Inbox, To Read, To Reply, Other
- As a user, I want emails to auto-mark as read when viewed in the reading pane
- As a user, I want thread grouping — emails in the same thread collapsed, with expand/collapse

**Acceptance criteria**:
- Gmail sync via Supabase Edge Function (gmail-sync) using Gmail API
- Email data cached in Supabase PostgreSQL with RLS
- Thread list with sender, subject, snippet, time, and unread indicator
- Split-view reading pane with Framer Motion slide-in animation
- Sanitized HTML rendering via DOMPurify
- Archive, trash, mark read/unread with optimistic updates and rollback
- Label management: FLOWSTATE/ToRead and FLOWSTATE/ToReply persisted as real Gmail labels
- Tab filtering: Inbox, To Read, To Reply, Other
- Auto-mark-as-read on 1-second view in reading pane
- Thread grouping by threadId with chronological ordering and collapse/expand
- Auto-advance selection after archive/trash
- PgUp/PgDn to cycle between mail tabs

**Status**: Partially Implemented — Core reading, navigation, archive, labeling, and tab structure work. Thread grouping with collapse/expand, search (`/`), and CSS scoping for email content are not yet implemented.

---

### FEATURE-00006: Mail Client — Compose & Reply

**Problem**: Users need to compose new emails and reply to threads without leaving FlowState.

**User stories**:
- As a user, I want to compose a new email with `c` — a modal with To, Cc/Bcc (collapsible), Subject, Body
- As a user, I want to reply inline at the bottom of the reading pane with `r`
- As a user, I want to reply-all with `a`
- As a user, I want to forward with `f` (opens compose pre-filled with original content)
- As a user, I want to send with Cmd+Enter and close/discard with Escape
- As a user, I want the body to support markdown, converted to HTML on send
- As a user, I want contact autocomplete when typing in the To/Cc/Bcc fields

**Acceptance criteria**:
- Compose modal triggered by `c` with To, Cc/Bcc (collapsible), Subject, Body fields
- Contact autocomplete in recipient fields
- Inline reply component at bottom of reading pane
- Reply (`r`), Reply All (`a`), Forward (`f`) keyboard triggers
- Markdown body converted to HTML on send via `marked` library
- Send via Edge Function (gmail-sync handleSendEmail) using RFC 2822 MIME
- Cmd+Enter to send, Escape to close
- Optimistic send: show "Sending..." state, restore draft on failure

**Status**: Partially Implemented — Compose modal works with To, Cc/Bcc, Subject, Body, contact autocomplete, and markdown-to-HTML conversion. Inline reply component exists. Forward pre-fills compose. Cmd+Enter sends. Some areas still need work: optimistic send pattern, attachment support (read-only download).

---

### FEATURE-00007: Offline Support & Data Reliability

**Problem**: Network connectivity is unreliable. Users must never lose work due to being offline or having a flaky connection.

**User stories**:
- As a user, I want my actions to queue when offline and sync automatically when I reconnect
- As a user, I want to see a visual indicator when I'm offline or syncing
- As a user, I want undo/redo for any destructive task action
- As a user, I want a guest mode to try the app without an account (local storage only)

**Acceptance criteria**:
- Pending operations queue in task store, processed on reconnect
- Online/offline status detection (useOnlineStatus hook)
- Visual sync indicator in TopNav showing offline state and pending operation count
- Full undo/redo history stack for task operations
- Guest mode with local-only storage, no Supabase required
- Optimistic updates with rollback on API failure for all store actions

**Status**: Implemented (Tasks only — mail actions do not queue offline. See P3 in [Architecture Alignment Review](../architecture/architecture-alignment-review.md). Accepted limitation for now.)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | React 19 + TypeScript (strict mode) |
| **Build** | Vite 6 |
| **State** | Zustand 5 (useTaskStore, useMailStore, useUIStore, useCoachStore) |
| **Styling** | Tailwind CSS + dark mode |
| **Animation** | Framer Motion |
| **Drag & Drop** | @dnd-kit |
| **Date Parsing** | chrono-node (NLP) + date-fns |
| **Email Sanitization** | isomorphic-dompurify |
| **Markdown** | marked |
| **Auth & DB** | Supabase (Auth, PostgreSQL, Edge Functions, RLS) |
| **AI** | Google Gemini API (@google/generative-ai) |
| **Email** | Gmail API (via Supabase Edge Function) |
| **Testing** | Vitest + @testing-library/react |
| **Icons** | lucide-react |
| **IDs** | uuid |
| **Confetti** | canvas-confetti |

---

## Success Metrics (North Stars)

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| **Tasks completed per day** | +20% vs baseline | Core value delivery |
| **Time to capture a task** | < 2 seconds | Friction-free capture |
| **Email triage speed** | < 2 seconds per decision | Keyboard-driven efficiency |
| **Inbox Zero rate** | Daily (tasks and email) | Intentional work, not accumulation |
| **Weekly Review completion** | 80% of weeks | Reflection habit formation |
| **Keyboard shortcut usage** | > 90% of actions | Power-user adoption confirmed |
| **Reading Pane latency** | < 100ms | Flow is never broken |

---

## Guiding Principles for Development

1. **Keyboard is king** — Every feature must have keyboard shortcuts
2. **Speed is a feature** — Optimize for < 100ms interactions
3. **Less is more** — Resist feature bloat, focus on core workflows
4. **Consistent patterns** — Same interaction model across all modules
5. **Offline-first** — Never lose user work due to connectivity
6. **AI enhances, not replaces** — Coach suggests, user decides
7. **No phantom UI** — If a feature isn't built, its UI doesn't exist
8. **Four states always** — Every data-driven component handles: loading, error, empty, loaded

---

## Future Modules (Roadmap)

These modules are part of the Focus OS vision but are not yet in scope for implementation:

| Module | Description | Integration |
|--------|-------------|-------------|
| **Calendar** | Focus-aware scheduling, time blocking linked to tasks, "Focus Time" protection | Google Calendar API |
| **Chat** | Unified messaging with batch reading (triage-style), Do Not Disturb by default | Google Chat API |
| **Workspace** | Focus-optimized browser tabs — purpose-based tab groups, session save/restore, reader mode | Custom implementation |

Each future module will follow the same patterns: keyboard-first, offline-capable, AI-enhanced, modular store.

---

*This document is the canonical product definition for FlowState. It should be updated as features are added or requirements change.*
