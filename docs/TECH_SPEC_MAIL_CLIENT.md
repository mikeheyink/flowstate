# Technical Specification: Mail Client Refactor

This document detail the technical implementation strategy for the Mail Client refactor, transitioning from a static "bento-box" layout to a dynamic "Shortwave-style" full-width interaction model.

## 1. Architectural Changes

### A. State Management (`useMailStore.ts`)
We need to track the visibility and interaction state of the dual-pane layout.

- **New State Field**: `isReadingPaneOpen: boolean` (Default: `false`).
- **Modified Logic**:
    - `setSelectedId`: If the Reading Pane is open, update content in real-time. If closed, selection only updates the highlighted row.
    - `setActiveTab`: Should reset `isReadingPaneOpen` to `false` (or keep it open if we want per-tab persistence, though PRD suggests a clear "back" behavior).

### B. Keyboard Registry (`useHotkeys.ts`)
Register new global/scoped hotkeys:
- `Enter`: Trigger `setReadingPaneOpen(true)`.
- `Escape`: Trigger `setReadingPaneOpen(false)`.
- `Arrows` / `J`/`K`: Navigate list (updates Reading Pane if open).

## 2. UI & Component Refactor

### A. Full-Width Container (`App.tsx` & `MailView.tsx`)
- **Modification**: Remove the `max-w-5xl` container in `App.tsx` (line 242) for the `mail` view.
- **Styling**: Ensure `MailView` and its children use `w-full h-full` and proper padding/margins for a premium full-width look.

### B. Dynamic Split View (`MailSplitView.tsx`)
Redesign the core layout to be responsive to the `isReadingPaneOpen` state.

```tsx
// Conceptual Structure
<div className="relative flex w-full h-full overflow-hidden">
    {/* List Pane */}
    <motion.div 
        animate={{ width: isReadingPaneOpen ? '450px' : '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="h-full border-r ..."
    >
        <ThreadList />
    </motion.div>

    {/* Reading Pane (Conditional Slide-in) */}
    <AnimatePresence>
        {isReadingPaneOpen && (
            <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                className="flex-1 h-full bg-white ..."
            >
                <ReadingPane />
            </motion.div>
        )}
    </AnimatePresence>
</div>
```

### C. Horizontal Record Row (`ThreadList.tsx`)
Refactor the row component to a horizontal grid/flex layout.

```tsx
<div className="flex items-center gap-8 py-3 px-6 hover:bg-slate-100 cursor-pointer">
    {/* Left Column: Sender (Fixed width or proportional) */}
    <div className="w-1/4 min-w-[150px] shrink-0 font-semibold truncate">
        {email.senderName}
    </div>

    {/* Right Column: Content stack */}
    <div className="flex-1 min-w-0 flex flex-col items-start overflow-hidden">
        <span className="font-medium text-slate-800 truncate w-full">
            {email.subject}
        </span>
        <span className="text-xs text-slate-500 truncate w-full">
            {email.snippet}
        </span>
    </div>

    {/* Metadata: Time / Indicators (Right aligned) */}
    <div className="text-xs text-slate-400 shrink-0">
        {email.time}
    </div>
</div>
```

## 3. Interaction Details

### Focus Management
- When `Enter` is pressed, the focus should conceptually remain on the list so that `Arrows` continue to work, but the visual affordance should shift to show the Reading Pane is the "active" context.
- When `Escape` is pressed, ensure the focus is explicitly back on the `ThreadList` container for continued navigation.

### Edge Cases
- **Archiving in Split View**: If an email is archived while the Reading Pane is open, the selection should advance to the next email, and the Reading Pane should update immediately. If it was the last email, the Reading Pane should close or show an empty state.
- **Search Interaction**: hitting `/` while the Reading Pane is open should focus the search bar. Deciding whether to close the Reading Pane automatically upon search is an open design question (Shortwave often keeps it open but narrows the list).

## 4. Animation Strategy
- **Library**: `framer-motion`.
- **Transitions**: Use "spring" physics (stiffness: 300, damping: 30) for the Reading Pane slide-in to match the rest of the OS.
- **Performance**: Use `layout` prop on motion components to handle the resizing of the list pane smoothly without layout shifts.

## 5. Implementation Steps
1.  **State**: Update `useMailStore` with `isReadingPaneOpen`.
2.  **Layout**: Remove `max-w-5xl` in `App.tsx`.
3.  **List**: Refactor `ThreadList` and its items to the new horizontal layout.
4.  **Split**: Implement the dynamic width/transition logic in `MailSplitView`.
5.  **Hotkeys**: Wire up `Enter` and `Escape`.
