# Fix Bulk Selection in TaskList

The bulk selection functionality (Shift+Arrow) is failing because the `keydown` event listener in `TaskList.tsx` depends on `selectedIds` directly. This causes the listener to be removed and re-added on every selection change (every key press in the sequence), leading to race conditions, dropped events, or stale closure issues where the handler doesn't see the most recent selection.

## Proposed Changes

### [components/TaskList.tsx](file:///c:/Users/mheyi/.gemini/antigravity/scratch/flowstate/components/TaskList.tsx)

#### [MODIFY] [TaskList.tsx](file:///c:/Users/mheyi/.gemini/antigravity/scratch/flowstate/components/TaskList.tsx)

1.  **Add `selectedIdsRef`**: Create a `useRef` to hold the current `selectedIds`.
2.  **Sync Ref**: Add a `useEffect` to keep `selectedIdsRef.current` in sync with `selectedIds`.
3.  **Update Handler**: Modify `handleKeyDown` to use `selectedIdsRef.current` instead of `selectedIds`.
4.  **Optimize Dependencies**: Remove `selectedIds` (and other now-stable or ref-based deps) from the `useEffect` dependency array for `handleKeyDown` to ensure the listener is stable.

## Verification Plan

### Manual Verification
1.  Open the app at `localhost:3000`.
2.  Create multiple tasks if not present.
3.  Click one task to focus.
4.  Hold `Shift` and press `ArrowDown` multiple times.
5.  Verify that multiple tasks are visually selected (highlighted).
6.  Release `Shift`.
7.  Press `ArrowDown` (without Shift). Verify selection clears and focus moves.
8.  Select multiple tasks again.
9.  Press `x` (Complete). Verify all selected tasks toggle completion.
10. Press `Delete`. Verify all selected tasks are deleted.
