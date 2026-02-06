# Flowstate Product Brief

> **Purpose**: This document provides AI developers with the context needed to understand what Flowstate is, who it's for, and what user needs it addresses.

---

## Product Vision

**Flowstate** is evolving from a keyboard-first task manager into **a complete Focus Operating System**—an all-in-one digital workspace designed for knowledge workers who demand speed, intentionality, and deep focus.

### The Problem We're Solving

Modern knowledge work is fragmented across dozens of tabs, apps, and contexts. Each context switch costs cognitive overhead. Traditional productivity tools optimize for features, not focus. The result: talented people spend more time managing tools than doing meaningful work.

### Our Vision: The Focus OS

Flowstate consolidates the core workflows of knowledge work into a single, keyboard-driven environment:

| Module | Description | Integration |
|--------|-------------|-------------|
| **Tasks** | Hierarchical task management with AI coaching | ✅ Built |
| **Mail** | Keyboard-first email (Superhuman-style) | 🏗️ Researching |
| **Calendar** | Focus-aware scheduling and time blocking | Google Calendar |
| **Chat** | Unified messaging without notification chaos | Google Chat |
| **Workspace** | Focus-optimized browser for research, not tab sprawl | Custom tabs |

### Core Philosophy

| Principle | Description |
|-----------|-------------|
| **Keyboard First** | Every action achievable via keyboard in <100ms |
| **Zero Context Switch** | One environment for all work, unified shortcuts |
| **Focus by Default** | No notifications, no distractions, no infinite scroll |
| **AI-Augmented** | Intelligence that helps you reflect and improve |
| **Speed is UX** | Sub-100ms response time for all interactions |

---

## Target User

**Primary Persona**: High-output knowledge workers (developers, designers, founders, executives) who:
- Spend 6+ hours daily in digital work environments
- Are frustrated by tab chaos and app switching
- Value keyboard efficiency over mouse clicking
- Want to protect their attention from notification culture
- Believe in systematic productivity and reflection

**Pain Points We Solve**:
1. **Tab sprawl**: 30+ browser tabs create cognitive overhead
2. **App switching**: Email → Slack → Calendar → ToDo wastes mental energy
3. **Notification fatigue**: Every app demands attention, none respect focus
4. **Tool fragmentation**: Tasks in one app, context in another
5. **No reflection**: Work happens but learning doesn't

---

## Current Feature Set

### 1. Task Management (Core)

| Feature | Description | Key Files |
|---------|-------------|-----------|
| Hierarchical Tasks | Tasks can have subtasks (unlimited depth) | `src/types.ts`, `src/store/useTaskStore.ts` |
| Priorities (P1-P4) | Visual flags, affects sort order | `src/components/TaskList/TaskItem.tsx` |
| Due Dates | Natural language parsing ("tomorrow", "next Friday") | `src/utils/nlp.ts` |
| Tags | #project, @context style tagging | Parsed from task title |
| Notes | Markdown notes for task details | `Task.notes` field |
| Drag & Drop | Reorder tasks within and across hierarchies | `src/components/TaskList/useTaskListDnd.ts` |
| Multi-select | Shift+Arrow to select multiple tasks | `src/components/TaskList/useTaskListKeyboard.ts` |

### 2. Smart Views

| View | Purpose | Filter Logic |
|------|---------|--------------|
| **Inbox** | All active tasks (inbox zero goal) | `!completed && !archived` |
| **Today** | Tasks due today + manually starred | Due date ≤ today OR `todayOrder` set |
| **Upcoming** | Future tasks grouped by date | Due date > today, grouped by timeframe |
| **Review** | Completed tasks by week | Grouped by ISO week of `completedAt` |

### 3. Keyboard-Driven UX

```
Navigation:
  j/↓    Move down          k/↑    Move up
  h/←    Collapse/outdent   l/→    Expand/indent
  Enter  New task           e      Edit task
  Space  Toggle complete    Tab    Cycle priority
  
Commands:
  Cmd+K       Command palette
  ?           Show shortcuts
  g then i    Go to Inbox
  g then t    Go to Today
  PgUp/PgDn   Cycle views
  
Multi-select:
  Shift+↓/↑   Extend selection
  Ctrl+↓/↑    Reorder tasks
```

### 4. AI Coach (Gemini-Powered)

- **Weekly Review Companion**: Chat about completed tasks
- **Calendar Context**: Paste calendar screenshots for analysis
- **Personalized Advice**: Stores user profile/goals for relevant feedback
- **Implementation**: `src/components/CoachChat.tsx`, `src/utils/gemini.ts`

### 5. Technical Features

| Feature | Description |
|---------|-------------|
| **Offline Support** | Queue operations when offline, sync when back |
| **Undo/Redo** | Full command pattern with history stack |
| **Optimistic Updates** | UI updates immediately, syncs in background |
| **Guest Mode** | Try without account (local storage only) |
| **Dark Mode** | Full dark theme support |

---

## User Stories

### Daily Workflow

> As a **knowledge worker**, I want to...

| # | User Story | Acceptance Criteria |
|---|-----------|---------------------|
| D1 | Quickly capture tasks as they come to mind | Enter → type → Enter creates task in <2 seconds |
| D2 | Review my inbox and process it to zero | Easily assign dates, priorities, or archive tasks |
| D3 | See only what I need to do today | "Today" view shows due + starred items only |
| D4 | Work through tasks without distractions | Keyboard navigation, no unnecessary UI chrome |
| D5 | Complete tasks and feel progress | Satisfying completion animation, tasks move to Review |

### Weekly Workflow

> As a **reflective professional**, I want to...

| # | User Story | Acceptance Criteria |
|---|-----------|---------------------|
| W1 | Review what I accomplished this week | Weekly Review groups completed tasks by week |
| W2 | Get intelligent feedback on my productivity | AI Coach analyzes patterns, suggests improvements |
| W3 | See tasks in context of their parent projects | Hierarchy paths shown in Review view |
| W4 | Plan next week with past context | Coach can see completed work and calendar |

### Project Management

> As a **project organizer**, I want to...

| # | User Story | Acceptance Criteria |
|---|-----------|---------------------|
| P1 | Break large tasks into subtasks | Indent/outdent with keyboard, unlimited depth |
| P2 | See project progress at a glance | Parent tasks show child count, expand/collapse |
| P3 | Reorder tasks by priority | Drag-and-drop or Ctrl+Arrow reordering |
| P4 | Move tasks between projects | Drag to new parent or use keyboard |

### Data & Reliability

> As a **user who values my data**, I want to...

| # | User Story | Acceptance Criteria |
|---|-----------|---------------------|
| R1 | Never lose work even if offline | Offline queue, conflict resolution |
| R2 | Undo mistakes easily | Cmd+Z undoes any action, Cmd+Shift+Z redoes |
| R3 | Try before signing up | Guest mode with full functionality |
| R4 | Access from multiple devices | Supabase sync across devices |

---

## Focus OS Roadmap

### Phase 0: Architecture Foundation (Completed)
Refactored codebase to support modular feature development.
- ✅ Moved core logic to `src/` directory
- ✅ Split `TaskList` component into focused hooks and sub-components
- ✅ Established testing infrastructure (Vitest)
- ✅ Extracted ordering logic from store

### Phase 1: Mail Module (In Progress)
Keyboard-first email client modeled after Superhuman:
- [x] Product research and specification (`docs/SUPERHUMAN_SPEC.md`)
- [ ] Gmail OAuth integration
- [ ] "To Read" and "To Reply" label workflows
- [ ] Full conversation threading
- [ ] Keyboard triage (e/h/l for archive, snooze, label)
- [ ] Inline reply with rich text

### Phase 2: Calendar Module  
Focus-aware scheduling:
- Google Calendar OAuth integration
- Time blocking linked to tasks
- "Focus Time" detection and protection
- Weekly review integration

### Phase 3: Chat Module
Unified messaging without notification chaos:
- Google Chat integration
- Batch message reading (like email triage)
- Do Not Disturb by default
- Keyboard-first navigation

### Phase 4: Workspace Module
Focus-optimized browser for research:
- Purpose-based tab groups (not sprawl)
- Session save/restore for context switching
- Reader mode for articles
- Integrated with tasks (link tasks to research)

> *Each module follows the same patterns: keyboard-first, offline-capable, AI-enhanced.*


---

## Technical Architecture Summary

┌─────────────────────────────────────────────────────────────┐
│                       React 19 + TypeScript                 │
├─────────────────────────────────────────────────────────────┤
│  src/components/       │  src/store/          │  src/utils/ │
│  ├─ TaskList/          │  ├─ useTaskStore     │  ├─ supabase│
│  ├─ WeeklyReview       │  ├─ useUIStore       │  ├─ gemini  │
│  ├─ CoachChat          │  └─ useCoachStore    │  └─ nlp     │
│  ├─ QuickAdd           │                      │             │
│  └─ CommandPalette     │                      │             │
├─────────────────────────────────────────────────────────────┤
│                    Zustand (State Management)               │
│             Offline queue, Undo/Redo, Persistence           │
├─────────────────────────────────────────────────────────────┤
│                         Supabase                            │
│           Auth (Google OAuth) • PostgreSQL • RLS            │
├─────────────────────────────────────────────────────────────┤
│                       Google Gemini API                     │
│                AI Coach for weekly reflections              │
└─────────────────────────────────────────────────────────────┘

---

## Success Metrics (North Stars)

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| **Tasks completed per day** | ↑ 20% vs baseline | Core value delivery |
| **Time to capture task** | < 2 seconds | Friction-free capture |
| **Inbox Zero rate** | Daily | Intentional work |
| **Weekly Review completion** | 80% of weeks | Reflection habit |
| **Keyboard shortcut usage** | > 90% of actions | Power user adoption |

---

## Guiding Principles for Development

1. **Keyboard is king** - Every feature must have keyboard shortcuts
2. **Speed is a feature** - Optimize for <100ms interactions
3. **Less is more** - Resist feature bloat, focus on core workflows
4. **Consistent patterns** - Use vim-style navigation everywhere
5. **Offline-first** - Never lose user work due to connectivity
6. **AI enhances, not replaces** - Coach suggests, user decides

---

*This document should be updated as the product evolves. It serves as the source of truth for what Flowstate is and why it exists.*
