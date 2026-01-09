# Debugging Challenge: "Today" View Sorting Conflict

## Tech Stack
- **Framework**: React + TypeScript + Vite
- **State Management**: Zustand
- **Backend**: Supabase
- **Drag & Drop**: @dnd-kit/core, @dnd-kit/sortable

## The Goal
I need to implement a **"Today" View** for a todo app.
1.  **Aggregation**: Shows all tasks due today (or overdue), regardless of which project/parent they belong to.
2.  **Flat Sort**: The list should be **flat** (no nesting).
3.  **Independent Manual Sorting**: Users must be able to drag-and-drop tasks in this view to reorder them arbitrarily (e.g., "Do this first, then that").
4.  **Persistence**: This specific order must be saved to a `today_order` field in the DB, **without** affecting the task's structural position (`parent_id`, `order`) in the main project list.

## The Problem
The sorting is currently "sticky" or broken.
**Symptoms**:
- When I drag Task A to be above Task B, if Task B belongs to a "Project" that is structurally above Task A's project, the sort refuses to update or snaps back.
- It seems the sorting logic is still implicitly tied to the `parent_id` or the default hierarchy, prohibiting true free-form reordering.

## Current Data Model
```typescript
interface Task {
  id: string;
  parentId?: string | null;  // Hierarchy
  order?: number;            // Sort order for Project View (default)
  todayOrder?: number | null; // Sort order for Today View (custom)
  dueDate?: Date | null;
  // ... other fields
}
```

## Current Implementation Attempts

### 1. Frontend Filtering & Logic (`TaskList.tsx`)
We attempted an "Effective Order" strategy:
- Separate tasks into "Important", "Outstanding", "Complete".
- For "Outstanding", we calculate an `effectiveOrder`. If `todayOrder` exists, use it. If not, generate a default based on the index.
- Sort the `visibleTasks` array by this `effectiveOrder`.

**Code Snippet (State Derivation):**
```typescript
// inside useMemo(() => { ... }, [tasks, filter])
if (filter === 'today') {
  // ... filtering candidates ...
  
  // Sort Outstanding: Overdue first, then Hierarchy fallback
  outstanding.sort((a, b) => {
    // ... overdue logic ...
    return compareHierarchy(a, b); // Fallback to project structure
  });

  // Assign Effective Order
  const outstandingVisible = outstanding.map((t, i) => {
    const defaultOrder = (i + 1) * 10000; 
    const effective = (t.todayOrder !== undefined && t.todayOrder !== null) 
      ? t.todayOrder 
      : defaultOrder;
    
    return { ...t, effectiveOrder: effective };
  });

  // Final Sort
  outstandingVisible.sort((a, b) => a.effectiveOrder - b.effectiveOrder);
  return [ ...important, ...outstandingVisible, ...completed ];
}
```

### 2. Drag Handler (`TaskList.tsx`)
We update `todayOrder` on drop.
```typescript
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over) return;

  const isToday = filter === 'today';
  const getOrder = (t: Task | VisibleTask) => {
    if (isToday) {
       // Try to use the computed effectiveOrder
       if ((t as any).effectiveOrder !== undefined) return (t as any).effectiveOrder;
       return t.todayOrder ?? (t.order || 0);
    }
    return t.order || 0;
  };

  if (active.id !== over.id) {
     const overTask = visibleTasks.find(t => t.id === over.id);
     const targetOrder = getOrder(overTask);
     
     // Calculate new order (simple mid-point or gap logic)
     let newOrder = targetOrder; 
     // ... logic to adjust +/- 5000 based on insert before/after ...

     moveTaskTo(active.id, null, newOrder, { context: 'today' });
  }
}
```

### 3. Store Update (`useTaskStore.ts`)
The store handles the Context to update the correct column.
```typescript
moveTaskTo: async (id, newParentId, newOrder, options) => {
  // ...
  if (options?.context === 'today') {
    // Update local state
    set(s => ({
      tasks: s.tasks.map(t => t.id === id ? { ...t, todayOrder: newOrder } : t)
    }));
    // Sync to DB
    await supabase.from('tasks').update({ today_order: newOrder }).eq('id', id);
  } else {
    // Normal Project Sort updates 'order' and 'parentId'
  }
}
```

## The Question
Why is this setup failing to produce a stable, manually reorderable list? 
1. Is mixing "Effective Order" (derived) with persisted `todayOrder` causing conflicts? 
2. Does `dnd-kit` require the underlying `tasks` array order to match the visual order strictly?
3. How can I refactor this to ensure `todayOrder` is the **sole source of truth** for the sorting in this view, ensuring 100% decoupling from hierarchy?
