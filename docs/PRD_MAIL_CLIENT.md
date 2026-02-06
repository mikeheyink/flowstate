# Flowstate Mail Client PRD

> **Purpose**: This document specifies the requirements and design for the new Mail Client module within Flowstate, transforming the application from a task manager into a multi-view Focus OS.

---

## 1. Product Vision

The Mail Client is the second major pillar of the Flowstate "Focus OS". It brings the intense speed and keyboard-centric philosophy of Flowstate to email management.

**Core Goal**: Integrate a Superhuman-class email experience directly into Flowstate, allowing users to flow seamlessly between managing tasks and processing communications without context switching.

---

## 2. Core Concept: "Views"

We are introducing a top-level navigation paradigm called **Views**.

### The Sliding Viewport
Instead of traditional page navigation, Flowstate treats different modules (Tasks, Mail) as adjacent "screens" in a spatial layout.

*   **Interaction**: User holds `Control` + `Arrow Right` or `Control` + `Arrow Left`.
*   **Visual**: The entire screen content "slides" horizontally to reveal the adjacent view.
*   **Transition**: Smooth, animated transition. No full page reload. State is preserved in previous views.

### View Taxonomy
1.  **Task Management** (Current View)
2.  **Mail Client** (New View)
3.  **Calendar** (Future)
4.  **Chat** (Future)

**User Story**:
> "As a user, I finish my deep work task, hold `Ctrl+Right`, and instantly slide into my Inbox to check for urgent updates, then slide back to my tasks."

---

## 3. Mail Client Specification

The Mail Client view must mirror the look, feel, and performance characteristics of the existing Task view. It is not just a mail reader; it is a **processing engine**.

### Design Philosophy
*   **Consistency**: Shared design tokens with Task View (typography, spacing, selection states).
*   **Keyboard First**: Mouse usage is optional. Every action has a hotkey.
*   **Speed**: <100ms interaction time (Optimistic UI).
*   **Mece Views**: Emails exist in exactly one state (Inbox, Read, Replied, etc.) to ensure Inbox Zero is achievable.
*   **Navigation Tabs**: The tabs located in the top navigation bar must maintain a consistent look and feel across all views (Tasks, Mail), ensuring a unified application aesthetic.
    *   **Mail Views**: Inbox | To Read | To Reply | All Mail

### Core Features

#### A. The List View
Similar to the Task List, but for emails.
*   **Visuals**: Clean rows, distinct read/unread states, clear sender/subject separation.
*   **Navigation**: `Arrow Down` (down) and `Arrow Up` (up) to traverse the list.
*   **Selection**: Shift+Arrow for multi-select.

#### B. Reading Pane
*   **Split View**: Option to see list on left, content on right (or full width list).
*   **Rendering**: Clean HTML rendering, stripped of unnecessary clutter.

#### C. Triage Actions (Shortcuts)
*   `x`: Archive (Done)
*   `Enter`: Open email / Expand thread -> (If open) Reply All
*   `Shift+Enter`: Reply
*   `f`: Forward
*   `r`: Label as "To Read" (Moves to Read tab)
*   `y`: Label as "To Reply" (Moves to Reply tab)
*   `#`: Delete

### Workflow
1.  **Triage**: User enters Mail view. Rapidly processes inbox using Arrow keys and `e`.
2.  **Deep Work**: Emails requiring work can be converted to Tasks (integration point).
3.  **Inbox Zero**: When the list is empty, display the "Inbox Zero" reward screen (consistent with Task "Inbox Zero").

---

## 4. Technical Implementation

### Implementation Phases
1.  **Views Engine**: Implement the `Ctrl+Arrow` sliding mechanism and container layout.
2.  **Mail UI Shell**: Create the empty Mail view component that matches Task View styling.
3.  **Mock Data Integration**: Populate with dummy email data to perfect the virtualized list and keyboard navigation.


---

## 5. Reference Material
*   **[PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md)**: Overall Focus OS vision.
*   **[AGENTS.md](./AGENTS.md)**: Coding standards and architectural constraints.
