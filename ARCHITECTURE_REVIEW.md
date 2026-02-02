# Architecture Review: Flowstate

> **Reviewer**: Senior Architect / Software Engineer  
> **Date**: 2026-02-02  
> **Scope**: Full codebase analysis for architectural weaknesses and improvement barriers

---

## Executive Summary

Flowstate is a well-functioning MVP with solid core features. However, certain architectural patterns will increasingly impede feature development, maintenance, and reliability as the product scales. This document identifies **10 critical areas** of concern, ranked by impact.

---

## 🔴 Critical Issues

### 1. God Objects: Monolithic Store & Component Files

| File | Lines | Concern |
|------|-------|---------|
| `useTaskStore.ts` | **1,136** | Single store handles CRUD, sync, history, selection, batch ops |
| `TaskList.tsx` | **1,325** | Rendering, navigation, DnD, sorting—all in one file |

**Impact**:
- Hard to onboard new developers (AI or human)
- Changes to one feature risk breaking unrelated features
- Re-renders are expensive—entire component tree reacts to any task change

**Recommendation**:
```
store/
├── useTaskStore.ts         # Core CRUD only (~300 lines)
├── useHistoryStore.ts      # Undo/Redo logic
├── useSelectionStore.ts    # Multi-select, batch actions
├── useSyncStore.ts         # Offline queue, Supabase sync
└── hooks/
    └── useTaskActions.ts   # Composite hook combining stores 
```

---

### 2. Duplicated Sorting Logic

Sorting/filtering logic is **repeated in 3+ places** with slight variations:

| Location | Sort Logic |
|----------|-----------|
| `TaskList.tsx` (lines 397-704) | View-specific filtering & sorting |
| `useTaskStore.ts` (`moveTask`, `addTask`) | Sibling ordering |
| `WeeklyReview.tsx` | Different grouping logic |

**Impact**:
- Bugs fixed in one place may not be fixed in others
- Adding new sort criteria (e.g., custom fields) requires changes everywhere

**Recommendation**:
- Extract into `utils/taskSort.ts` with pure functions:
  - `sortByHierarchy(tasks)`
  - `filterByView(tasks, view, options)`
  - `groupByDate(tasks, bucketFn)`

---

### 3. Fragile Undo/Redo Implementation

The Command Pattern implementation has **critical flaws**:

```typescript
// useTaskStore.ts lines 1086-1109
undo: async () => {
    const state = get();
    const command = state.history.pop(); // ⚠️ Mutates array!
    // ...
    // Lines 1094-1098 show confusion about mutation
}
```

**Issues**:
- `state.history.pop()` mutates state directly (Zustand anti-pattern)
- Undo callbacks capture stale closures (e.g., `toggleImportance` has placeholder undo)
- No transaction grouping—can't undo "batch indent 5 tasks" as one action
- History not persisted—refresh loses undo stack

**Impact**:
- Unreliable undo behavior leads to user data loss
- Some operations (importance toggle) have broken undo

**Recommendation**:
- Implement immutable history updates
- Store task snapshots instead of closures
- Add `CommandGroup` for batch operations

---

### 4. Tight Coupling: Component ↔ Store

`TaskList.tsx` directly accesses **15+ store actions**:

```typescript
// Lines 341-373
const tasks = useTaskStore((state) => state.tasks);
const focusedId = useTaskStore(/* ... */);
const setFocusedId = useTaskStore(/* ... */);
const toggleTask = useTaskStore(/* ... */);
const deleteTask = useTaskStore(/* ... */);
// ... 10+ more
```

**Impact**:
- Component is untestable without mocking entire store
- Store interface changes require component changes
- AI agents make mistakes when store API is large

**Recommendation**:
- Create facade hooks: `useTaskListActions()` that bundles related actions
- Use composition: `<TaskListProvider>` for scoped context

---

## 🟠 Major Issues

### 5. Keyboard Handler Sprawl

Keyboard shortcuts are split across **3 locations**:

| File | Shortcuts |
|------|-----------|
| `App.tsx` | Undo, Redo, Batch Paste, View Cycling, Command Palette |
| `TaskList.tsx` | Navigation, Indent, Delete, Edit |
| `WeeklyReview.tsx` | Separate navigation for review |

**Impact**:
- Conflicting shortcuts are possible
- No single source of truth for shortcut documentation
- Hard to implement user-customizable shortcuts

**Recommendation**:
- Centralize in `hooks/useKeyboardShortcuts.ts`
- Use action dispatchers rather than direct function calls
- Generate `ShortcutsModal` content from same source

---

### 6. Mixed DB Sync Concerns

Database sync is interleaved with business logic:

```typescript
// addTask() in useTaskStore.ts
// Lines 243-336: 90+ lines mixing:
//   - Business logic (ordering, parsing)
//   - Optimistic updates
//   - Supabase queries
//   - User auth checks
```

**Impact**:
- Can't test business logic without mocking Supabase
- Sync errors are hard to debug
- Guest mode checks scattered throughout

**Recommendation**:
- Separate into layers:
  - `addTask()` → pure business logic, returns new state
  - `syncTask()` → handles Supabase communication
  - Middleware pattern for offline queue

---

### 7. No Error Boundaries for Data Operations

Supabase operations have basic try/catch but:
- Errors are logged, not surfaced to users consistently
- No retry logic for transient failures
- Partial failures in batch operations leave inconsistent state

**Example** (lines 199-214):
```typescript
for (const op of state.pendingOperations) {
    try {
        // ... process
    } catch (error) {
        console.warn('Failed to process...'); // Silent failure
        remaining.push(op);
    }
}
```

**Impact**:
- Users unaware of sync failures
- Data may silently diverge between local and server

---

### 8. View Logic in Components Instead of Store

Each view (Today, Upcoming, Inbox) has **independent filtering logic** in `TaskList.tsx`:

```typescript
// Lines 433-703: ~270 lines of view-specific logic
if (filter === 'active') { /* ... */ }
if (filter === 'today') { /* ... */ }  
if (filter === 'upcoming') { /* ... */ }
```

**Impact**:
- Adding a new view requires modifying a 1300-line component
- Can't reuse view logic elsewhere (e.g., widget, API)

**Recommendation**:
- Move to `store/views/` or `hooks/useTaskViews.ts`
- Views become pure selectors from task state

---

## 🟡 Improvement Opportunities

### 9. TypeScript Any Escape Hatches

Several `any` types reduce type safety:

```typescript
// useTaskStore.ts line 14
data?: any;

// TaskList.tsx lines 159, 691
(task as any).count

// Multiple places use @ts-ignore
```

**Impact**:
- Type errors not caught at compile time
- AI agents struggle without type hints

---

### 10. Missing Virtualization

`TaskList.tsx` renders all visible tasks in DOM:
- 200+ tasks = 200+ DOM nodes
- Each task item has complex nested structure

**Impact**:
- Performance degrades with large task lists
- Mobile scrolling stutters

**Recommendation**:
- Implement `react-window` or `@tanstack/virtual` for large lists

---

## Summary: Priority Matrix

| Issue | Severity | Effort | Recommendation |
|-------|----------|--------|----------------|
| God Objects (Store/Component) | 🔴 Critical | High | Split incrementally |
| Duplicated Sorting Logic | 🔴 Critical | Medium | Extract to utils |
| Fragile Undo/Redo | 🔴 Critical | High | Reimplement properly |
| Component↔Store Coupling | 🔴 Critical | Medium | Facade hooks |
| Keyboard Handler Sprawl | 🟠 Major | Medium | Centralize |
| Mixed DB Sync Concerns | 🟠 Major | High | Layer separation |
| No Error Boundaries | 🟠 Major | Low | Add user feedback |
| View Logic in Components | 🟠 Major | Medium | Move to selectors |
| TypeScript Any Usage | 🟡 Minor | Low | Fix incrementally |
| Missing Virtualization | 🟡 Minor | Medium | Add for scale |

---

## Recommended Next Steps

1. **Immediate** (before new features):
   - Fix undo/redo mutation bugs
   - Extract sorting utilities

2. **Short-term** (next sprint):
   - Split `useTaskStore.ts` into focused modules
   - Create `useTaskListActions()` facade

3. **Medium-term**:
   - Centralize keyboard shortcuts
   - Implement proper error boundaries with user feedback

4. **Long-term**:
   - Full layer separation (business logic ↔ sync ↔ UI)
   - Virtualized list for scale

---

*This review is meant as constructive guidance. The codebase works well for an MVP—these changes will help it scale.*
