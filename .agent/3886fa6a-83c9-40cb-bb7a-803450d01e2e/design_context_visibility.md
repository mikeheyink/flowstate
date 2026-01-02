# Design: Task Context in Flat Views

## Problem Definition
In hierarchical lists (Inbox), tasks are nested under parents (e.g., `Project A > Task 1`).
In flat lists (Today, Completed), this hierarchy is flattened, stripping the context. A task named "Call Sarah" becomes ambiguous without its parent project "Wedding" or "Work".

## Proposed Solution: Parent Breadcrumbs

We will display formatted "breadcrumbs" for tasks that have a parent, specifically in non-hierarchical views.

### Design Options

#### Option 1: Inline Pill (Recommended)
Display the parent name as a small, styled badge to the right of the task title.
*   **Format**: `[Check] Task Title <Parent Name>`
*   **Visuals**: Small font (text-xs), grey color (text-slate-400), subtle background pill (bg-slate-100).
*   **Pros**: Minimalist, preserves vertical rhythm, consistent with "Tag" styling.
*   **Cons**: Can get crowded on mobile with long titles.

#### Option 2: Eyebrow Label
Display the parent path above the task title.
*   **Format**:
    `Parent Name`
    `[Check] Task Title`
*   **Pros**: Maximum clarity.
*   **Cons**: Doubles the height of list items, breaking the "dense" feel of the app.

## Implementation Plan
1.  **Update `TaskList`**:
    *   Inject the full `tasks` list into the component so we can lookup parent titles by `parentId`.
    *   (Currently, `TaskList` might only have the filtered list, so it might need access to the global list or we pass a `parentMap`).
2.  **Conditional Rendering**:
    *   Only show this badge if `task.parentId` exists AND `task.depth === 0` (which implies we are in a flattened view or it's a root item).
3.  **Visuals**:
    *   Use the existing badge styles used for Tags/Priority for consistency.
