# Mobile Subtask Creation

We will add "Indent" and "Outdent" controls to the `QuickAdd` component.
This allows mobile users (who lack Tab/Shift+Tab) to nest tasks while typing.

## User Review Required
None. This is a purely additive UI change.

## Proposed Changes

### UI Components

#### [MODIFY] [QuickAdd.tsx](file:///c:/Users/mheyi/.gemini/antigravity/scratch/flowstate/components/QuickAdd.tsx)
-   Add `Indent (Tab)` and `Outdent (Shift+Tab)` icon buttons inside the input area (right side).
-   **Logic**:
    -   **Indent**: Finds the *last visible task* in the current list and sets it as the `activeParentId`. This treats the new task as a child of the one just before it.
    -   **Outdent**: If there is an `activeParentId`, moves up one level (sets parent to `grandParentId` or `null`).
-   **Visuals**: Small, subtle icons inside the input field to maintain minimalism.

## Logic Detail
*   **Indent**: `setQuickAddOpen(true, lastVisibleTaskId, 'create')`
*   **Outdent**: `setQuickAddOpen(true, currentParent?.parentId || null, 'create')`

## Verification Plan
### Manual Verification
1.  Open Quick Add on Mobile (click FAB).
2.  Type "Task A", hit Enter.
3.  Type "Task B", tap **Indent (>)** icon.
    *   Verify badge "Subtask for Task A" appears.
    *   Hit Enter.
4.  Verify "Task B" is nested under "Task A".
5.  Tap **Outdent (<)** icon.
    *   Verify badge disappears.
    *   Type "Task C", hit Enter.
6.  Verify "Task C" is a top-level task (sibling of A).
