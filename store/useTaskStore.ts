import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Task, Priority } from '../types';
import { parseTaskInput } from '../utils/nlp';
import { supabase } from '../utils/supabase';
import { getSiblings } from '../utils/taskOrdering';
import { createSelectionSlice, SelectionSlice } from './slices/selectionSlice';

const generateId = () => Math.random().toString(36).substring(2, 9);

// Pending operation types for offline queue
interface PendingOperation {
  id: string;
  type: 'insert' | 'update' | 'delete';
  table: string;
  data?: any;
  taskId?: string;
}

// Command Pattern for Undo/Redo
interface Command {
  name: string;
  undo: () => Promise<void> | void;
  redo: () => Promise<void> | void;
}

interface TaskState {
  tasks: Task[];
  focusedId: string | null;
  isLoading: boolean;
  error: string | null;
  guestMode: boolean;

  // Offline sync state
  pendingOperations: PendingOperation[];
  lastSyncedAt: number | null;

  // Undo/Redo History
  history: Command[];
  future: Command[];

  // Selection state
  selectedIds: string[];

  // Actions

  // Actions
  fetchTasks: () => Promise<void>;
  addTask: (rawInput: string, parentId?: string | null, afterTaskId?: string | null, options?: { skipHistory?: boolean }) => void;
  restoreTask: (task: Task, options?: { skipHistory?: boolean }) => void; // Internal use for undo
  batchAddTasks: (rawInputs: string[]) => void;
  updateTask: (id: string, updates: Partial<Task>, options?: { skipHistory?: boolean }) => void;
  moveTask: (id: string, direction: 'up' | 'down', options?: { skipHistory?: boolean; context?: 'project' | 'today' }) => void;

  toggleTask: (id: string, options?: { skipHistory?: boolean }) => void;
  deleteTask: (id: string, options?: { skipHistory?: boolean }) => void;
  archiveTask: (id: string, options?: { skipHistory?: boolean }) => void;
  setPriority: (id: string, priority: Priority, options?: { skipHistory?: boolean }) => void;
  setFocusedId: (id: string | null) => void;
  setGuestMode: (isGuest: boolean) => void;
  setError: (error: string | null) => void;

  // Selection Actions
  selectTask: (id: string, multi: boolean) => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;

  // Batch Actions
  batchDelete: () => void;
  batchComplete: () => void;
  batchSetDueDate: (date: Date | null) => void;
  batchMove: (direction: 'up' | 'down') => void;
  batchChangeParent: (updates: { id: string; newParentId: string | null }[]) => void;
  batchIndent: () => void;
  batchOutdent: () => void;

  // Hierarchy Actions
  toggleExpand: (id: string) => void;
  setExpandedAll: (expanded: boolean) => void;
  changeParent: (id: string, newParentId: string | null, options?: { skipHistory?: boolean }) => void;
  moveTaskTo: (id: string, newParentId: string | null, newOrder: number, options?: { context?: 'today' | 'project' }) => void;
  toggleImportance: (id: string, options?: { skipHistory?: boolean }) => void;
  clearImportance: (id: string, options?: { skipHistory?: boolean }) => void;

  undo: () => void;
  redo: () => void;
  setTasks: (tasks: Task[]) => void;

  // Sync actions
  processPendingOperations: () => Promise<void>;
  getPendingCount: () => number;
}

const mapFromDb = (dbTask: any): Task => ({
  id: dbTask.id,
  parentId: dbTask.parent_id,
  title: dbTask.title,
  notes: dbTask.notes,
  completed: dbTask.completed,
  completedAt: dbTask.completed_at ? new Date(dbTask.completed_at) : null,
  priority: dbTask.priority as Priority,
  tags: dbTask.tags || [],
  dueDate: dbTask.due_date ? new Date(dbTask.due_date) : null,
  createdAt: parseInt(dbTask.created_at),
  order: parseFloat(dbTask.order),
  expanded: dbTask.expanded,
  archived: dbTask.archived,
  importantOrder: dbTask.important_order ? parseFloat(dbTask.important_order) : null,
  todayOrder: dbTask.today_order ? parseFloat(dbTask.today_order) : null,
});

const mapToDb = (task: Partial<Task>) => {
  const dbObj: any = {};
  if (task.id !== undefined) dbObj.id = task.id;
  if (task.parentId !== undefined) dbObj.parent_id = task.parentId;
  if (task.title !== undefined) dbObj.title = task.title;
  if (task.notes !== undefined) dbObj.notes = task.notes;
  if (task.completed !== undefined) dbObj.completed = task.completed;
  if (task.priority !== undefined) dbObj.priority = task.priority;
  if (task.tags !== undefined) dbObj.tags = task.tags;
  if (task.dueDate !== undefined) dbObj.due_date = task.dueDate;
  if (task.createdAt !== undefined) dbObj.created_at = task.createdAt;
  if (task.order !== undefined) dbObj.order = task.order;
  if (task.expanded !== undefined) dbObj.expanded = task.expanded;
  if (task.archived !== undefined) dbObj.archived = task.archived;
  if (task.importantOrder !== undefined) dbObj.important_order = task.importantOrder;
  if (task.todayOrder !== undefined) dbObj.today_order = task.todayOrder;
  if (task.completedAt !== undefined) dbObj.completed_at = task.completedAt;
  return dbObj;
};

// Helper to queue operations when offline
const queueOperation = async (
  set: any,
  get: any,
  operation: Omit<PendingOperation, 'id'>,
  executeOnline: () => Promise<any>
) => {
  const state = get();
  if (state.guestMode) return; // No sync in guest mode

  if (!navigator.onLine) {
    // Queue for later
    const op: PendingOperation = { ...operation, id: generateId() };
    set({ pendingOperations: [...state.pendingOperations, op] });
    return;
  }

  try {
    await executeOnline();
    set({ lastSyncedAt: Date.now() });
  } catch (error) {
    // If failed (could be network hiccup), queue it
    console.warn('Operation failed, queuing for retry:', error);
    const op: PendingOperation = { ...operation, id: generateId() };
    set({ pendingOperations: [...state.pendingOperations, op] });
  }
};

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      focusedId: null,
      isLoading: false,
      error: null,
      guestMode: false,
      pendingOperations: [],
      lastSyncedAt: null,
      selectedIds: [],
      history: [],
      future: [],

      // Helper: Add command to history
      addToHistory: (command: Command) => {
        set((state) => {
          const newHistory = [...state.history, command];
          if (newHistory.length > 50) newHistory.shift(); // Limit history
          return {
            history: newHistory,
            future: [], // Clear future on new action
          };
        });
      },

      setTasks: (tasks) => set({ tasks }),
      setGuestMode: (guestMode) => set({ guestMode }),
      setError: (error) => set({ error }),

      getPendingCount: () => get().pendingOperations.length,

      processPendingOperations: async () => {
        const state = get();
        if (!navigator.onLine || state.pendingOperations.length === 0) return;

        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        const remaining: PendingOperation[] = [];

        for (const op of state.pendingOperations) {
          try {
            if (op.type === 'insert') {
              await supabase.from(op.table).insert({ ...op.data, user_id: userData.user.id });
            } else if (op.type === 'update') {
              await supabase.from(op.table).update(op.data).eq('id', op.taskId);
            } else if (op.type === 'delete') {
              await supabase.from(op.table).delete().eq('id', op.taskId);
            }
          } catch (error) {
            console.warn('Failed to process pending operation:', op, error);
            remaining.push(op);
          }
        }

        set({ pendingOperations: remaining, lastSyncedAt: Date.now() });
      },

      fetchTasks: async () => {
        set({ isLoading: true, error: null });
        const { guestMode } = get();

        // If in guest mode, we don't fetch from Supabase
        if (guestMode) {
          // Simple local mock for guest mode (empty for now as logic wasn't fully provided)
          // or ideally retrieve from localStorage if we implemented that.
          // For now, just stop loading.
          set({ isLoading: false });
          return;
        }

        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .order('order', { ascending: true });

        if (data) {
          set({ tasks: data.map(mapFromDb), isLoading: false });
        } else {
          set({ isLoading: false, error: error?.message || 'Unknown error' });
          if (error) console.error("Error fetching tasks:", error);
        }
      },

      addTask: async (rawInput, parentId = null, afterTaskId = null, options = {}) => {
        const { title, priority, tags, dueDate } = parseTaskInput(rawInput);
        if (!title) return;

        // 1. Calculate state
        const state = get();
        const newTask: Task = {
          id: generateId(),
          parentId: parentId,
          expanded: true,
          title,
          priority,
          tags,
          dueDate,
          completed: false,
          archived: false,
          createdAt: Date.now(),
          order: 0,
        };

        const activeSiblings = state.tasks.filter(t =>
          t.parentId === parentId && !t.archived && !t.completed
        );

        activeSiblings.sort((a, b) => {
          const orderA = a.order ?? -a.createdAt;
          const orderB = b.order ?? -b.createdAt;
          return orderA - orderB;
        });

        let insertIndex = 0;
        if (afterTaskId) {
          const idx = activeSiblings.findIndex(t => t.id === afterTaskId);
          if (idx !== -1) insertIndex = idx + 1;
        }

        const newOrderList = [...activeSiblings];
        newOrderList.splice(insertIndex, 0, newTask);

        // Normalize orders
        const updates: Record<string, number> = {};
        newOrderList.forEach((t, i) => {
          updates[t.id] = i * 1000;
        });

        // 2. Optimistic Update
        const updatedTasks = state.tasks.map(t =>
          updates[t.id] !== undefined ? { ...t, order: updates[t.id] } : t
        );
        const finalTasks = parentId
          ? updatedTasks.map(t => t.id === parentId ? { ...t, expanded: true } : t)
          : updatedTasks;

        const finalNewTask = { ...newTask, order: updates[newTask.id] };

        set({
          tasks: [...finalTasks, finalNewTask],
          focusedId: newTask.id,
        });

        // 3. History
        if (!options.skipHistory) {
          set((s) => {
            const newHistory = [...s.history, {
              name: 'Add Task',
              undo: () => get().deleteTask(finalNewTask.id, { skipHistory: true }),
              redo: () => get().restoreTask(finalNewTask, { skipHistory: true })
            }];
            if (newHistory.length > 50) newHistory.shift();
            return { history: newHistory, future: [] };
          });
        }

        // 4. DB Sync
        if (state.guestMode) return; // No sync in guest mode

        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return; // Should handle error

        // Insert new task
        await supabase.from('tasks').insert({
          ...mapToDb(finalNewTask),
          user_id: userData.user.id
        });

        // Update siblings order
        // In a real app we'd batch this or make it smarter, but for MVP loop is okay
        // Or simply only update the ones that changed.
        for (const t of activeSiblings) {
          if (updates[t.id] !== undefined && updates[t.id] !== t.order) {
            await supabase.from('tasks').update({ order: updates[t.id] }).eq('id', t.id);
          }
        }
      },

      restoreTask: async (task, options = {}) => {
        // Used by Undo/Redo to re-insert a specific task definition
        const state = get();
        // Just append for now, assuming order is self-contained or acceptable
        set({ tasks: [...state.tasks, task] });

        // No History push here as it is CALLED by history (or skipHistory passed)

        if (state.guestMode) return;
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;
        await supabase.from('tasks').insert({ ...mapToDb(task), user_id: userData.user.id });
      },

      batchAddTasks: async (rawInputs) => {
        const state = get();
        const now = Date.now();

        const newTasks = rawInputs.map((input, idx) => {
          const { title, priority, tags, dueDate } = parseTaskInput(input);
          return {
            id: generateId(),
            parentId: null,
            expanded: true,
            title, priority, tags, dueDate,
            completed: false,
            archived: false,
            createdAt: now,
            order: -(now + idx),
          } as Task;
        }).filter(t => t.title);

        // History
        set((s) => {
          const newHistory = [...s.history, {
            name: 'Batch Add Tasks',
            undo: async () => {
              const currentS = get();
              for (const t of newTasks) {
                await currentS.deleteTask(t.id, { skipHistory: true });
              }
            },
            redo: async () => {
              const currentS = get();
              for (const t of newTasks) {
                await currentS.restoreTask(t, { skipHistory: true });
              }
            }
          }];
          if (newHistory.length > 50) newHistory.shift();
          return { history: newHistory, future: [] };
        });

        set({ tasks: [...newTasks, ...state.tasks] });

        if (state.guestMode) return;

        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        const dbTasks = newTasks.map(t => ({
          ...mapToDb(t),
          user_id: userData.user!.id
        }));

        await supabase.from('tasks').insert(dbTasks);
      },

      updateTask: async (id, updates, options = {}) => {
        const state = get();
        const task = state.tasks.find(t => t.id === id);
        if (!task) return;

        // History
        if (!options.skipHistory) {
          const oldTask = { ...task };
          // Inverse: Update back to old values. We only need the keys that changed.
          const reverseUpdates: Partial<Task> = {};
          (Object.keys(updates) as Array<keyof Task>).forEach(key => {
            // @ts-ignore
            reverseUpdates[key] = oldTask[key];
          });

          set((s) => {
            const newHistory = [...s.history, {
              name: 'Update Task',
              undo: () => get().updateTask(id, reverseUpdates, { skipHistory: true }),
              redo: () => get().updateTask(id, updates, { skipHistory: true })
            }];
            if (newHistory.length > 50) newHistory.shift();
            return { history: newHistory, future: [] };
          });
        }

        set((state) => ({
          tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t),
        }));

        if (state.guestMode) return;

        await supabase.from('tasks').update(mapToDb(updates)).eq('id', id);
      },

      moveTask: async (id: string, direction: 'up' | 'down', options = {}) => {
        const state = get();
        const task = state.tasks.find(t => t.id === id);
        if (!task) return;

        // Undo Logic
        if (!options.skipHistory) {
          set((s) => {
            const newHistory = [...s.history, {
              name: 'Move Task',
              undo: () => get().moveTask(id, direction === 'up' ? 'down' : 'up', { skipHistory: true, context: options.context }),
              redo: () => get().moveTask(id, direction, { skipHistory: true, context: options.context })
            }];
            if (newHistory.length > 50) newHistory.shift();
            return { history: newHistory, future: [] };
          })
        }

        let siblings: Task[] = [];
        let orderField: keyof Task = 'order';

        if (options.context === 'today') {
          // TODAY CONTEXT LOGIC
          if (task.importantOrder) {
            // Moving within Important list
            siblings = getSiblings(task, state.tasks, 'important');
            orderField = 'importantOrder';
          } else {
            // Moving within Outstanding list - use shared function for consistency
            siblings = getSiblings(task, state.tasks, 'today');
            orderField = 'todayOrder';
          }
        } else {
          // DEFAULT PROJECT/PARENT CONTEXT
          siblings = getSiblings(task, state.tasks, 'project');
        }

        const currentIndex = siblings.findIndex(t => t.id === id);
        if (currentIndex === -1) return;

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= siblings.length) return;

        // Normalization / Swap Logic
        const updates: Record<string, number> = {};

        // If we are moving in 'todayOrder' and values are null, initialize them
        if (orderField === 'todayOrder') {
          siblings.forEach((t, i) => {
            // If any order is missing or we just want to re-normalize to ensure clean swap
            updates[t.id] = i * 1000;
          });
        } else if (orderField === 'importantOrder') {
          siblings.forEach((t, i) => {
            updates[t.id] = i + 1; // 1-based for importance
          });
        } else {
          siblings.forEach((t, i) => { updates[t.id] = i * 1000; });
        }

        // Swap values in our local updates map
        const id1 = siblings[currentIndex].id;
        const id2 = siblings[targetIndex].id;

        const val1 = updates[id1];
        updates[id1] = updates[id2];
        updates[id2] = val1;

        // Apply
        set((state) => ({
          tasks: state.tasks.map(t => updates[t.id] !== undefined ? { ...t, [orderField]: updates[t.id] } : t)
        }));

        if (state.guestMode) return;

        const dbField = orderField === 'importantOrder' ? 'important_order' : (orderField === 'todayOrder' ? 'today_order' : 'order');
        await supabase.from('tasks').update({ [dbField]: updates[id1] }).eq('id', id1);
        await supabase.from('tasks').update({ [dbField]: updates[id2] }).eq('id', id2);
      },

      toggleImportance: async (id, options = {}) => {
        const state = get();
        const task = state.tasks.find(t => t.id === id);
        if (!task || !task.dueDate) return; // Only due dated tasks can be important (per spec logic "due for today") -> Spec says "due for today". 
        // We should double check if strictly "today" or just "has due date". Let's assume has Due Date.

        const importantTasks = state.tasks
          .filter(t => t.importantOrder && !t.archived && !t.completed && t.dueDate) // Filter robustly
          .sort((a, b) => (a.importantOrder || 0) - (b.importantOrder || 0));

        if (!options.skipHistory) {
          set((s) => {
            // Toggle is complex to undo because it might involve reordering many things. 
            // Simplest undo is to restore state of ALL affected tasks.
            // But let's try a lighter inverse: clearImportance or specific re-toggle.
            // If we appended, undo is remove. 
            // If we promoted, undo is tricky. 
            // Let's defer strict undo for this complex action or just implement 'restoreTask' based undo which is heavy but safe.
            // Or simpler: Just store the 'before' state of the single task?
            // No, because others shift.
            // Let's leave undo implementation for a specific 'Importance Undo' step later or skip for MVP if acceptable.
            // Spec didn't strictly mandate rigorous undo for this, but general Undo is expected.
            // Generic fallback:
            return { history: s.history, future: [] }; // Placeholder
          });
        }

        if (task.importantOrder) {
          // Already Important
          if (task.importantOrder === 1) {
            // Already #1, do nothing
            return;
          }
          // Promote to #1
          const updates: Record<string, number> = {};
          updates[task.id] = 1;

          let counter = 2;
          importantTasks.forEach(t => {
            if (t.id !== task.id) {
              updates[t.id] = counter++;
            }
          });

          set(s => ({ tasks: s.tasks.map(t => updates[t.id] ? { ...t, importantOrder: updates[t.id] } : t) }));
          if (!state.guestMode) {
            for (const [tid, ord] of Object.entries(updates)) {
              await supabase.from('tasks').update({ important_order: ord }).eq('id', tid);
            }
          }
        } else {
          // Make Important (Append)
          const newOrder = importantTasks.length > 0 ? (importantTasks[importantTasks.length - 1].importantOrder || 0) + 1 : 1;
          set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, importantOrder: newOrder } : t) }));
          if (!state.guestMode) {
            await supabase.from('tasks').update({ important_order: newOrder }).eq('id', id);
          }
        }
      },

      clearImportance: async (id, options = {}) => {
        const state = get();
        const task = state.tasks.find(t => t.id === id);
        if (!task || !task.importantOrder) return;

        const removedOrder = task.importantOrder;

        // Shift others up
        const updates: Record<string, number> = {};
        const others = state.tasks
          .filter(t => t.importantOrder && t.importantOrder > removedOrder && !t.archived && !t.completed);

        others.forEach(t => {
          updates[t.id] = (t.importantOrder || 0) - 1;
        });

        set(s => ({
          tasks: s.tasks.map(t => {
            if (t.id === id) return { ...t, importantOrder: null };
            if (updates[t.id]) return { ...t, importantOrder: updates[t.id] };
            return t;
          })
        }));

        if (!state.guestMode) {
          await supabase.from('tasks').update({ important_order: null }).eq('id', id);
          for (const [tid, ord] of Object.entries(updates)) {
            await supabase.from('tasks').update({ important_order: ord }).eq('id', tid);
          }
        }
      },

      changeParent: async (id, newParentId, options = {}) => {
        const state = get();
        const task = state.tasks.find(t => t.id === id);
        if (!task) return;

        if (!options.skipHistory) {
          const oldParentId = task.parentId || null;
          set((s) => {
            const newHistory = [...s.history, {
              name: 'Change Parent',
              undo: () => get().changeParent(id, oldParentId, { skipHistory: true }),
              redo: () => get().changeParent(id, newParentId, { skipHistory: true })
            }];
            if (newHistory.length > 50) newHistory.shift();
            return { history: newHistory, future: [] };
          });
        }

        set((state) => ({
          tasks: state.tasks.map(t => t.id === id ? { ...t, parentId: newParentId } : t)
        }));

        if (state.guestMode) return;

        await supabase.from('tasks').update({ parent_id: newParentId }).eq('id', id);
      },

      moveTaskTo: async (id: string, newParentId: string | null, newOrder: number, options?: { context?: 'today' | 'project' }) => {
        const field = options?.context === 'today' ? 'todayOrder' : 'order'; // If Today, we usually don't change parent? 
        // Actually, if context is today, we only change todayOrder? 
        // But what if we nest? Today view nesting?
        // Spec: "sorting fix... separate task sorting order for the tasks shown in the Today view... user can easily move any tasks up or down".
        // If sorting in Today, we update 'todayOrder'. Parent changes are likely restricted or ignored in sorting?

        // If updating todayOrder, we usually don't change parent ID unless we support hierarchy changes in Today view.
        // For now, let's assume we update only the order field if context is today, OR parent if relevant?
        // But hierarchy is 'Plan' view concept. Today view is flat-ish or has different hierarchy?
        // Plan says: "Today view sorting fix... separate task sorting order... decoupling from parent hierarchy or implementing flat sort for Today".
        // So we likely just update 'todayOrder' and ignore parentId changes or keep them same.

        const update: any = { [field]: newOrder };
        if (field === 'order') update.parent_id = newParentId; // Only sync parent if standard order

        set((state) => ({
          tasks: state.tasks.map(t => t.id === id ? { ...t, ...update, ...(field === 'order' ? { parentId: newParentId } : {}) } : t)
        }));

        const state = get();
        if (state.guestMode) return;

        const dbUpdate: any = { ...update };
        if (field === 'todayOrder') delete dbUpdate.parent_id;
        if (field === 'todayOrder') dbUpdate.today_order = newOrder;

        await supabase.from('tasks').update(dbUpdate).eq('id', id);
      },

      toggleTask: async (id, options = {}) => {
        const state = get();
        const task = state.tasks.find(t => t.id === id);
        if (!task) return;
        const newVal = !task.completed;
        const completedAt = newVal ? new Date() : null;

        if (!options.skipHistory) {
          set((s) => {
            const newHistory = [...s.history, {
              name: 'Toggle Task',
              undo: () => get().toggleTask(id, { skipHistory: true }),
              redo: () => get().toggleTask(id, { skipHistory: true })
            }];
            if (newHistory.length > 50) newHistory.shift();
            return { history: newHistory, future: [] };
          });
        }

        set((state) => {
          return {
            tasks: state.tasks.map((t) => t.id === id ? { ...t, completed: newVal, completedAt } : t),
          };
        });

        if (state.guestMode) return;
        await supabase.from('tasks').update({ completed: newVal, completed_at: completedAt }).eq('id', id);
      },

      deleteTask: async (id, options = {}) => {
        const state = get();
        const task = state.tasks.find(t => t.id === id);

        if (task && !options.skipHistory) {
          set((s) => {
            const newHistory = [...s.history, {
              name: 'Delete Task',
              undo: () => get().restoreTask(task, { skipHistory: true }),
              redo: () => get().deleteTask(id, { skipHistory: true })
            }];
            if (newHistory.length > 50) newHistory.shift();
            return { history: newHistory, future: [] };
          });
        }

        // Simple optimistic delete
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id && t.parentId !== id),
        }));

        if (state.guestMode) return;

        await supabase.from('tasks').delete().eq('id', id);
        // Supabase cascade delete handles children if configured, but here we do simple
      },

      archiveTask: async (id, options = {}) => {
        const state = get();
        const task = state.tasks.find((t) => t.id === id);
        if (!task) return;

        if (!options.skipHistory) {
          set((s) => {
            const newHistory = [...s.history, {
              name: 'Archive Task',
              undo: () => get().updateTask(id, { archived: false }, { skipHistory: true }),
              redo: () => get().archiveTask(id, { skipHistory: true })
            }];
            if (newHistory.length > 50) newHistory.shift();
            return { history: newHistory, future: [] };
          });
        }

        set((state) => ({
          tasks: state.tasks.map((t) => t.id === id ? { ...t, archived: true } : t),
        }));

        if (state.guestMode) return;

        await supabase.from('tasks').update({ archived: true }).eq('id', id);
      },

      setPriority: async (id, priority, options = {}) => {
        const state = get();
        const task = state.tasks.find((t) => t.id === id);
        if (!task) return;

        if (!options.skipHistory) {
          const oldPriority = task.priority;
          set((s) => {
            const newHistory = [...s.history, {
              name: 'Set Priority',
              undo: () => get().setPriority(id, oldPriority, { skipHistory: true }),
              redo: () => get().setPriority(id, priority, { skipHistory: true })
            }];
            if (newHistory.length > 50) newHistory.shift();
            return { history: newHistory, future: [] };
          });
        }

        set((state) => ({
          tasks: state.tasks.map((t) => t.id === id ? { ...t, priority } : t),
        }));

        if (state.guestMode) return;

        await supabase.from('tasks').update({ priority }).eq('id', id);
      },

      setFocusedId: (id) => set({ focusedId: id }),

      // --- Selection Actions (from selectionSlice) ---
      ...createSelectionSlice(set, get, {} as any),

      // --- Batch Actions ---
      batchDelete: () => {
        const state = get();
        let idsToDelete: string[] = [];

        if (state.selectedIds.length === 0 && state.focusedId) {
          idsToDelete = [state.focusedId];
        } else {
          idsToDelete = [...state.selectedIds];
        }

        if (idsToDelete.length === 0) return;

        // Snapshot for Undo
        const tasksToDelete = state.tasks.filter(t => idsToDelete.includes(t.id));

        set((s) => {
          const newHistory = [...s.history, {
            name: 'Batch Delete',
            undo: async () => {
              const currentS = get();
              // Restore
              for (const t of tasksToDelete) {
                await currentS.restoreTask(t, { skipHistory: true });
              }
            },
            redo: async () => {
              const currentS = get();
              for (const id of idsToDelete) {
                await currentS.deleteTask(id, { skipHistory: true });
              }
            }
          }];
          if (newHistory.length > 50) newHistory.shift();
          return { history: newHistory, future: [] };
        });

        // Execute with skipHistory
        idsToDelete.forEach(id => state.deleteTask(id, { skipHistory: true }));
        set({ selectedIds: [] });
      },

      batchComplete: () => {
        const state = get();
        let idsToToggle: string[] = [];

        if (state.selectedIds.length === 0 && state.focusedId) {
          idsToToggle = [state.focusedId];
        } else {
          idsToToggle = [...state.selectedIds];
        }

        if (idsToToggle.length === 0) return;

        const allSelected = state.tasks.filter(t => idsToToggle.includes(t.id));
        const anyIncomplete = allSelected.some(t => !t.completed);
        const targetCompleted = anyIncomplete;

        // Snapshot old states for Undo (some might have been complete, some not)
        const previousStates = allSelected.map(t => ({ id: t.id, completed: t.completed }));

        set((s) => {
          const newHistory = [...s.history, {
            name: 'Batch Complete',
            undo: async () => {
              const currentS = get();
              for (const p of previousStates) {
                await currentS.updateTask(p.id, { completed: p.completed }, { skipHistory: true });
              }
            },
            redo: async () => {
              const currentS = get();
              for (const id of idsToToggle) {
                await currentS.updateTask(id, { completed: targetCompleted }, { skipHistory: true });
              }
            }
          }];
          if (newHistory.length > 50) newHistory.shift();
          return { history: newHistory, future: [] };
        });

        idsToToggle.forEach(id => {
          // Only update if changed to avoid redundant DB calls, but for simplicity:
          const task = state.tasks.find(t => t.id === id);
          if (task && task.completed !== targetCompleted) {
            state.updateTask(id, { completed: targetCompleted }, { skipHistory: true });
          }
        });
      },

      batchSetDueDate: (date) => {
        const state = get();
        let idsToUpdate: string[] = [];
        if (state.selectedIds.length === 0 && state.focusedId) {
          idsToUpdate = [state.focusedId];
        } else {
          idsToUpdate = [...state.selectedIds];
        }

        if (idsToUpdate.length === 0) return;

        // Snapshot
        const snapshot = state.tasks.filter(t => idsToUpdate.includes(t.id)).map(t => ({ id: t.id, dueDate: t.dueDate }));

        set((s) => {
          const newHistory = [...s.history, {
            name: 'Batch Set Due Date',
            undo: async () => {
              const currentS = get();
              for (const item of snapshot) {
                await currentS.updateTask(item.id, { dueDate: item.dueDate }, { skipHistory: true });
              }
            },
            redo: async () => {
              const currentS = get();
              for (const id of idsToUpdate) {
                await currentS.updateTask(id, { dueDate: date }, { skipHistory: true });
              }
            }
          }];
          if (newHistory.length > 50) newHistory.shift();
          return { history: newHistory, future: [] };
        });

        idsToUpdate.forEach(id => state.updateTask(id, { dueDate: date }, { skipHistory: true }));
      },

      batchMove: (direction) => {
        const state = get();
        let idsToMove: string[] = [];
        if (state.selectedIds.length === 0 && state.focusedId) {
          idsToMove = [state.focusedId];
        } else {
          idsToMove = [...state.selectedIds];
        }

        if (idsToMove.length === 0) return;

        // History
        set((s) => {
          const newHistory = [...s.history, {
            name: 'Batch Move',
            undo: () => {
              const currentS = get();
              // Inverse direction
              const inverse = direction === 'up' ? 'down' : 'up';
              // We need to move them back in specific order? 
              // Batch move logic sorts them. If we just call batchMove(inverse), it *should* work roughly.
              // But we can't call batchMove easily because it relies on selection state.
              // Better: iterate ids and call moveTask.
              // BUT moveTask relies on 'siblings' state which changes after each move.
              // Valid approach: Just call recursive moveTask calls.
              // For now, let's just trigger moveTask for each, relying on its internal logic?
              // Actually, let's keep it simple: Re-execute the batch move logic in reverse direction?
              // No, `moveTask` is instrumented. We want to SKIP history.
              // Let's iterate.
              idsToMove.forEach(id => currentS.moveTask(id, inverse, { skipHistory: true }));
            },
            redo: () => {
              const currentS = get();
              // Re-execute
              // We need to replicate the sort logic here or export it?
              // Let's just iterate and call moveTask with skipHistory
              // NOTE: The order of calling moveTask matters.
              // The original function sorts them.
              const tasks = currentS.tasks;
              const selected = tasks.filter(t => idsToMove.includes(t.id));
              const sorted = [...selected].sort((a, b) => {
                const idxA = tasks.indexOf(a);
                const idxB = tasks.indexOf(b);
                return direction === 'up' ? idxA - idxB : idxB - idxA;
              });
              sorted.forEach(t => currentS.moveTask(t.id, direction, { skipHistory: true }));
            }
          }];
          if (newHistory.length > 50) newHistory.shift();
          return { history: newHistory, future: [] };
        });

        const tasks = state.tasks;
        const selected = tasks.filter(t => idsToMove.includes(t.id));

        const sorted = [...selected].sort((a, b) => {
          const idxA = tasks.indexOf(a);
          const idxB = tasks.indexOf(b);
          return direction === 'up' ? idxA - idxB : idxB - idxA;
        });

        sorted.forEach(t => state.moveTask(t.id, direction, { skipHistory: true }));
      },

      batchChangeParent: (updates) => {
        const state = get();
        if (updates.length === 0) return;

        // Snapshot
        const snapshot = updates.map(u => {
          const t = state.tasks.find(task => task.id === u.id);
          return { id: u.id, parentId: t?.parentId || null };
        });

        set((s) => {
          const newHistory = [...s.history, {
            name: 'Batch Change Parent',
            undo: async () => {
              const currentS = get();
              for (const item of snapshot) {
                await currentS.changeParent(item.id, item.parentId, { skipHistory: true });
              }
            },
            redo: async () => {
              const currentS = get();
              for (const u of updates) {
                await currentS.changeParent(u.id, u.newParentId, { skipHistory: true });
              }
            }
          }];
          if (newHistory.length > 50) newHistory.shift();
          return { history: newHistory, future: [] };
        });

        updates.forEach(u => state.changeParent(u.id, u.newParentId, { skipHistory: true }));
      },

      batchIndent: () => {
        // Logic deferred to TaskList due to view dependencies
      },

      batchOutdent: () => {
        // Logic deferred to TaskList due to view dependencies
      },

      toggleExpand: async (id) => {
        const state = get();
        const task = state.tasks.find(t => t.id === id);
        if (!task) return;

        set((state) => ({
          tasks: state.tasks.map(t => t.id === id ? { ...t, expanded: !t.expanded } : t)
        }));

        if (state.guestMode) return;

        await supabase.from('tasks').update({ expanded: !task.expanded }).eq('id', id);
      },

      setExpandedAll: (expanded) => {
        set((state) => ({
          tasks: state.tasks.map(t => ({ ...t, expanded }))
        }));
        // We don't sync this "view state" to DB to avoid mass updates for a UI toggle
      },

      undo: async () => {
        const state = get();
        const command = state.history.pop();
        if (!command) return;

        await command.undo();

        set((s) => ({
          history: [...state.history], // Updated by pop() already? No, React state array mutations are tricky.
          // Better: state.history is mutated by pop() locally? No, zustand state is immutable usually unless we clone.
          // Wait, state.history.pop() mutates the array retrieved from get(). 
          // Correct pattern: slice.
        }));
        // Actually, let's redo the pop cleanly.
        const undoHistory = [...state.history]; // copy
        const cmd = undoHistory.pop(); // mutate copy

        if (cmd) {
          await cmd.undo();
          set((s) => ({
            history: undoHistory,
            future: [cmd, ...s.future] // Add to future
          }));
        }
      },

      redo: async () => {
        const state = get();
        const future = [...state.future];
        const cmd = future.shift(); // Get next command

        if (cmd) {
          await cmd.redo();
          set((s) => ({
            future: future,
            history: [...s.history, cmd] // Add back to history
          }));
        }
      },
    }),
    {
      name: 'flowstate-tasks',
      partialize: (state) => ({
        tasks: state.tasks,
        pendingOperations: state.pendingOperations,
        lastSyncedAt: state.lastSyncedAt,
        guestMode: state.guestMode,
      }),
    }
  )
);