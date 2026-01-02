# Product Design & Architect Handoff: Keyboard-First Productivity App

## Vision
To build a "Godspeed for the masses"—a web-based, high-performance productivity tool that prioritizes keyboard-driven workflows and maintains the user's focus through sub-100ms latency and intuitive, Vim-inspired navigation.

---

## User Personas

### 1. The Developer Flow-State Enthusiast
*   **Profile**: Uses Vim/Emacs, relies on tiling window managers, and becomes frustrated by mouse-heavy interfaces.
*   **Need**: Needs a tasks manager that feels as fast as their IDE.
*   **Key Behavior**: Uses `Cmd+K` for everything, leverages blind typing, and expects instant feedback.

### 2. The High-Volume Task Manager
*   **Profile**: Handles 50+ tasks daily across multiple projects.
*   **Need**: Rapid capture and bulk organization without context switching.
*   **Key Behavior**: Uses NLP for quick entry and bulk selects tasks for re-tagging or archiving.

---

## Technical Architecture Requirements (The Architect's Guide)

### 1. Centralized Key-Handling Registry
The architect must implement a robust keyboard management system that:
*   Supports global and contextual keybindings.
*   Prevents conflicts between browser defaults and app-specific shortcuts.
*   Allows for easy remapping (Vim mode vs. Standard mode).
*   **Tech Hint**: Consider a library like `Mousetrap` or a custom React Context provider for hotkey registration.

### 2. Low-Latency State Management
To achieve the 100ms "Perceived Instant" goal:
*   State must be optimized for fast re-renders (Zustand or Atomic state like Jotai/Recoil recommended over bulky Redux).
*   Optimistic UI updates for all write operations (Create, Update, Delete).
*   Virtual List rendering for high-volume task lists (e.g., `react-window` or `react-virtuoso`).

### 3. NLP Engine (The "Quick Add" Core)
The natural language parser should:
*   Be lightweight enough for client-side execution to eliminate network latency during typing.
*   Support syntax like: `Buy milk @personal tomorrow at 5pm !high`.
*   **Tech Hint**: `chrono-node` for date/time parsing is the industry standard.

---

### 4. High-Performance Data Model
The architect should design a schema that supports rapid retrieval and bulk updates.
*   **Task Entity**: `id, title, status, project_id, due_date, tags[], created_at, updated_at`.
*   **Project Entity**: `id, name, color, order`.
*   **Action Log**: `id, action_type, payload, timestamp` (for undo history).

---

## Keyboard Interaction Strategy

### Focus Scope Management
A critical requirement is **Focus Trapping** and **Hotkeys Scoping**:
*   **Global Level**: `Cmd+K` (Search), `N` (New Task), `C` (Calendar).
*   **List Level**: `J/K` (Move), `X` (Select), `E` (Edit).
*   **Editor Level**: `Esc` (Save & Exit), `Cmd+Enter` (Save & New).

### Modifier Patterns
*   `Shift` + `Arrow Keys/J/K`: Range selection.
*   `Alt` + `Up/Down`: Move task within list (re-ordering).
*   `Cmd` (or `Ctrl` on Windows): Used for system-level actions (Undo, Search, Save).

---

## Epics and User Stories

### Epic 1: The Command Interface
**US.1.1: The Command Palette**
*   **As a user**, I want to press `Cmd+K` to search for any command, so I can perform actions without hunting through menus.
*   **Acceptance Criteria**:
    *   Palette opens in <50ms.
    *   Fuzzy search logic for commands.
    *   Keyboard navigation within the palette (`J`, `K`, `Enter`).

### Epic 2: Fluid Navigation
**US.2.1: Vim-Inspired List Movement**
*   **As a power user**, I want to navigate the task list using `J` (down) and `K` (up) and `Enter` to expand/edit.
*   **Acceptance Criteria**:
    *   Visual focus ring/indicator moves instantly.
    *   Scroll position updates to keep the focused item in view.

### Epic 3: High-Velocity Capture
**US.3.1: Inline NLP Quick Entry**
*   **As a user**, I want to start typing a task and see the date/tag metadata being parsed in real-time.
*   **Acceptance Criteria**:
    *   Highlighting or "pill" creation within the input field as dates/tags are recognized.
    *   `Enter` to save and reset focus to a clean entry state.

### Epic 4: Resilience and Safety
**US.4.1: Instant Undo (Cmd+Z)**
*   **As a user**, I want to undo any action immediately with `Cmd+Z`, so I can recover from accidental deletions or bulk edits.
*   **Acceptance Criteria**:
    *   Snapshot-based state history.
    *   Multi-level undo capability (last 10-20 actions).

---

## Success Metrics (The Outcome)
*   **Time to Entry**: Average time from app load to first task creation < 5 seconds.
*   **Mouse Usage Rate**: < 5% of all actions performed via mouse by power users (retained users).
*   **Perceived Speed**: User survey feedback targeting a "Very Fast" rating from > 80% of users.

---

## Verification Plan

### Automated Tests
*   **Keyboard Simulation Tests**: Use Cypress or Playwright to simulate key presses (`J`, `K`, `Cmd+K`) and assert focus changes.
*   **Latency Benchmarks**: Unit tests for the NLP parser asserting <20ms parsing time for complex strings.
*   **State Integrity**: Test that `Cmd+Z` accurately restores state after a bulk delete.

### Manual Verification
1.  **"No Mouse" Challenge**: Attempt to create 10 tasks, filter by tag, and archive 5 of them without touching the mouse/trackpad once.
2.  **Latency Feeling**: Perform rapid-fire actions and check if the UI "stutters" or lags behind the fingers.
