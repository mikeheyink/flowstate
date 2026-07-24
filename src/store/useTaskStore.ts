import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Task, Priority } from '../types';
import { parseTaskInput } from '../utils/nlp';
import { supabase } from '../utils/supabase';
import { getSiblings } from '../utils/taskOrdering';
import { quadrantOf, quadKey, sortQuadrant, topOfQuadrant } from '../utils/quad';
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
  addTask: (rawInput: string, parentId?: string | null, afterTaskId?: string | null, options?: { skipHistory?: boolean; defaultDueDate?: Date | null; important?: boolean; urgent?: boolean }) => void;
  restoreTask: (task: Task, options?: { skipHistory?: boolean }) => void; // Internal use for undo
  batchAddTasks: (rawInputs: string[]) => void;
  updateTask: (id: string, updates: Partial<Task>, options?: { skipHistory?: boolean }) => void;
  moveTask: (id: string, direction: 'up' | 'down', options?: { skipHistory?: boolean; context?: 'project' | 'quad' }) => void;

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
  pushTodayToTomorrow: () => number;
  batchMove: (direction: 'up' | 'down', options?: { context?: 'project' | 'quad' }) => void;
  batchChangeParent: (updates: { id: string; newParentId: string | null }[]) => void;
  batchIndent: () => void;
  batchOutdent: () => void;

  // Hierarchy Actions
  toggleExpand: (id: string) => void;
  setExpandedAll: (expanded: boolean) => void;
  changeParent: (id: string, newParentId: string | null, options?: { skipHistory?: boolean }) => void;
  moveTaskTo: (id: string, newParentId: string | null, newOrder: number, options?: { context?: 'quad' | 'project' }) => void;
  // Eisenhower flags: manual, independent of due date. Toggling moves the task
  // to the top of its new quadrant (focus follows it in the UI).
  toggleUrgent: (id: string, options?: { skipHistory?: boolean }) => void;
  toggleImportant: (id: string, options?: { skipHistory?: boolean }) => void;

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
  // Eisenhower fields, with graceful derivation from the legacy columns for
  // rows written before the quad migration (important_order / today_order).
  urgent: !!dbTask.urgent,
  important: dbTask.important != null ? !!dbTask.important : dbTask.important_order != null,
  quadOrder: dbTask.quad_order != null
    ? parseFloat(dbTask.quad_order)
    : dbTask.important_order != null
      ? parseFloat(dbTask.important_order) * 1000 // preserve the old Important list's order
      : dbTask.today_order != null
        ? parseFloat(dbTask.today_order)
        : null,
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
  if (task.urgent !== undefined) dbObj.urgent = task.urgent;
  if (task.important !== undefined) dbObj.important = task.important;
  if (task.quadOrder !== undefined) dbObj.quad_order = task.quadOrder;
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

// Shared implementation for toggleUrgent / toggleImportant.
// Quadrant membership is derived from the flags; this only needs to (1) flip
// the flag, (2) compute a quadOrder that lands the task at the top of its new
// quadrant among today's members, and (3) record an undo that restores both.
const toggleQuadFlag = (
  set: any,
  get: any,
  id: string,
  flag: 'urgent' | 'important',
  options: { skipHistory?: boolean } = {}
) => {
  const state = get();
  const task = state.tasks.find((t: Task) => t.id === id);
  if (!task) return;

  const prev = { urgent: !!task.urgent, important: !!task.important, quadOrder: task.quadOrder ?? null };
  const next = { urgent: prev.urgent, important: prev.important, [flag]: !prev[flag] } as { urgent: boolean; important: boolean };

  // Destination-quadrant members currently visible in the Today quad
  // (due today or overdue, excluding the task itself).
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const destQuadrant = quadrantOf(next);
  const members = state.tasks.filter((t: Task) =>
    t.id !== id && !t.archived && !t.completed && t.dueDate &&
    new Date(t.dueDate) < endOfToday && quadrantOf(t) === destQuadrant
  );
  const newQuadOrder = topOfQuadrant(members);

  if (!options.skipHistory) {
    set((s: any) => {
      const newHistory = [...s.history, {
        name: flag === 'urgent' ? 'Toggle Urgent' : 'Toggle Important',
        undo: () => get().updateTask(id, prev, { skipHistory: true }),
        redo: () => get().updateTask(id, { ...next, quadOrder: newQuadOrder }, { skipHistory: true }),
      }];
      if (newHistory.length > 50) newHistory.shift();
      return { history: newHistory, future: [] };
    });
  }

  get().updateTask(id, { urgent: next.urgent, important: next.important, quadOrder: newQuadOrder }, { skipHistory: true });
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

        // A date typed into the input wins; otherwise inherit the view's default
        // (e.g. today in Today, the focused day in Upcoming).
        const finalDueDate = dueDate ?? options.defaultDueDate ?? null;

        // Eisenhower flags inherited from the focused row / quadrant. Both are
        // independent of the due date (the whole point of the quad model).
        const urgent = !!options.urgent;
        const important = !!options.important;

        // Quadrant placement: directly below the reference row when it lives in
        // the same quadrant (mirrors the sibling-insert in Plan), else the top
        // of the destination quadrant. Ties on quadKey resolve by createdAt, so
        // "+1" reliably lands the new task just after its reference.
        const afterTask = afterTaskId ? state.tasks.find(t => t.id === afterTaskId) : null;
        let quadOrder: number | null = null;
        if (afterTask && quadrantOf(afterTask) === quadrantOf({ urgent, important })) {
          quadOrder = quadKey(afterTask) + 1;
        } else {
          const quadrant = quadrantOf({ urgent, important });
          const members = state.tasks.filter(t =>
            !t.archived && !t.completed && t.dueDate && quadrantOf(t) === quadrant
          );
          quadOrder = topOfQuadrant(members);
        }

        const newTask: Task = {
          id: generateId(),
          parentId: parentId,
          expanded: true,
          title,
          priority,
          tags,
          dueDate: finalDueDate,
          urgent,
          important,
          quadOrder,
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

        // 'quad' = position within the task's current Eisenhower quadrant;
        // 'project' = the Plan hierarchy. The two never touch each other.
        const context = options.context === 'quad' ? 'quad' : 'project';
        const orderField: keyof Task = context === 'quad' ? 'quadOrder' : 'order';
        const siblings = getSiblings(task, state.tasks, context);

        const currentIndex = siblings.findIndex(t => t.id === id);
        if (currentIndex === -1) return;

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        // At the quadrant/list edge: stop. In the quad, flags (u/i) are the only
        // way to cross into another quadrant — over-scrolling never re-prioritizes.
        if (targetIndex < 0 || targetIndex >= siblings.length) return;

        // Normalize all siblings (also initializes any null quadOrders), then swap.
        const updates: Record<string, number> = {};
        siblings.forEach((t, i) => { updates[t.id] = i * 1000; });

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

        // Persist the full normalization, not just the swapped pair — otherwise
        // siblings whose null quadOrder was initialized locally would reload in
        // a different position (their fallback key is createdAt, not i*1000).
        const dbField = orderField === 'quadOrder' ? 'quad_order' : 'order';
        const before = new Map(siblings.map(t => [t.id, t[orderField] as number | null | undefined]));
        for (const [tid, val] of Object.entries(updates)) {
          if (before.get(tid) !== val) {
            await supabase.from('tasks').update({ [dbField]: val }).eq('id', tid);
          }
        }
      },

      // Shared implementation for the two Eisenhower flag toggles.
      // Flipping a flag moves the task to another quadrant: it enters at the
      // TOP (you just decided it matters differently — it's top-of-mind), and
      // undo restores both the flags and the previous quadOrder, so a toggle
      // round-trip puts the task back exactly where it was.
      toggleUrgent: (id, options = {}) => {
        toggleQuadFlag(set, get, id, 'urgent', options);
      },

      toggleImportant: (id, options = {}) => {
        toggleQuadFlag(set, get, id, 'important', options);
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

      moveTaskTo: async (id: string, newParentId: string | null, newOrder: number, options?: { context?: 'quad' | 'project' }) => {
        // 'quad' updates only quadOrder (the Today quad is flat — hierarchy is a
        // Plan concept); 'project' updates Plan order and may re-parent.
        const isQuad = options?.context === 'quad';

        set((state) => ({
          tasks: state.tasks.map(t => t.id === id
            ? (isQuad
              ? { ...t, quadOrder: newOrder }
              : { ...t, order: newOrder, parentId: newParentId })
            : t)
        }));

        const state = get();
        if (state.guestMode) return;

        const dbUpdate: any = isQuad
          ? { quad_order: newOrder }
          : { order: newOrder, parent_id: newParentId };

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

      // Reschedule every outstanding task due today-or-earlier to tomorrow.
      // Returns the number of tasks moved so the caller can surface a toast.
      pushTodayToTomorrow: () => {
        const state = get();
        const now = new Date();
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
        // Tomorrow at noon — avoids timezone edge cases that could land it back on today.
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12, 0, 0);

        const targets = state.tasks.filter(t => {
          if (t.completed || t.archived || !t.dueDate) return false;
          return new Date(t.dueDate).getTime() < endOfToday;
        });

        if (targets.length === 0) return 0;

        const snapshot = targets.map(t => ({ id: t.id, dueDate: t.dueDate }));
        const ids = targets.map(t => t.id);

        set((s) => {
          const newHistory = [...s.history, {
            name: 'Push to Tomorrow',
            undo: async () => {
              const currentS = get();
              for (const item of snapshot) {
                await currentS.updateTask(item.id, { dueDate: item.dueDate }, { skipHistory: true });
              }
            },
            redo: async () => {
              const currentS = get();
              for (const id of ids) {
                await currentS.updateTask(id, { dueDate: tomorrow }, { skipHistory: true });
              }
            }
          }];
          if (newHistory.length > 50) newHistory.shift();
          return { history: newHistory, future: [] };
        });

        ids.forEach(id => state.updateTask(id, { dueDate: tomorrow }, { skipHistory: true }));
        return targets.length;
      },

      batchMove: (direction, options = {}) => {
        const state = get();
        const context = options.context;
        const idsToMove = state.selectedIds.length > 0
          ? [...state.selectedIds]
          : (state.focusedId ? [state.focusedId] : []);
        if (idsToMove.length === 0) return;

        // Single selection → delegate to moveTask (keeps its own history/sync).
        if (idsToMove.length === 1) {
          state.moveTask(idsToMove[0], direction, { context });
          return;
        }

        // Resolve the sibling list + order field from context, mirroring moveTask.
        const rep = state.tasks.find(t => idsToMove.includes(t.id));
        if (!rep) return;
        const resolvedContext = context === 'quad' ? 'quad' : 'project';
        const orderField: keyof Task = resolvedContext === 'quad' ? 'quadOrder' : 'order';
        const siblings = getSiblings(rep, state.tasks, resolvedContext);

        const sibIds = siblings.map(t => t.id);
        const selectedSet = new Set(idsToMove.filter(id => sibIds.includes(id)));
        if (selectedSet.size === 0) return;

        const selIdx = sibIds.map((id, i) => (selectedSet.has(id) ? i : -1)).filter(i => i >= 0);
        const minI = Math.min(...selIdx);
        const maxI = Math.max(...selIdx);

        // Move the whole block by one by hopping the single unselected neighbour
        // across it — so a contiguous selection shifts as a unit instead of its
        // members leapfrogging (and cancelling) each other.
        const newIds = [...sibIds];
        if (direction === 'down') {
          if (maxI >= sibIds.length - 1) return; // already at the bottom
          const neighbor = newIds.splice(maxI + 1, 1)[0];
          newIds.splice(minI, 0, neighbor);
        } else {
          if (minI <= 0) return; // already at the top
          const neighbor = newIds.splice(minI - 1, 1)[0];
          newIds.splice(maxI, 0, neighbor);
        }

        const updates: Record<string, number> = {};
        newIds.forEach((id, i) => { updates[id] = i * 1000; });

        const snapshot = siblings.map(t => ({ id: t.id, val: (t[orderField] as number | null) ?? null }));

        set((s) => {
          const newHistory = [...s.history, {
            name: 'Batch Move',
            undo: () => {
              set((st) => ({
                tasks: st.tasks.map(t => {
                  const snap = snapshot.find(x => x.id === t.id);
                  return snap ? { ...t, [orderField]: snap.val } : t;
                })
              }));
            },
            redo: () => {
              set((st) => ({
                tasks: st.tasks.map(t => (updates[t.id] !== undefined ? { ...t, [orderField]: updates[t.id] } : t))
              }));
            },
          }];
          if (newHistory.length > 50) newHistory.shift();
          return { history: newHistory, future: [] };
        });

        set((s) => ({
          tasks: s.tasks.map(t => (updates[t.id] !== undefined ? { ...t, [orderField]: updates[t.id] } : t))
        }));

        if (state.guestMode) return;
        const dbField = orderField === 'quadOrder' ? 'quad_order' : 'order';
        snapshot.forEach(({ id, val }) => {
          if (updates[id] !== val) {
            supabase.from('tasks').update({ [dbField]: updates[id] }).eq('id', id).then(() => { }, () => { });
          }
        });
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
      version: 1,
      // v0 → v1: Eisenhower quad. Derive the new flag/ordering fields from the
      // legacy importantOrder/todayOrder so nobody's Important list is lost.
      migrate: (persisted: any, version: number) => {
        if (!persisted || version >= 1) return persisted;
        if (Array.isArray(persisted.tasks)) {
          persisted.tasks = persisted.tasks.map((t: any) => {
            if (!t || 'important' in t) return t;
            const { importantOrder, todayOrder, ...rest } = t;
            return {
              ...rest,
              urgent: false,
              important: importantOrder != null,
              quadOrder: importantOrder != null
                ? importantOrder * 1000 // preserve the old Important list's order
                : todayOrder ?? null,
            };
          });
        }
        return persisted;
      },
      partialize: (state) => ({
        tasks: state.tasks,
        pendingOperations: state.pendingOperations,
        lastSyncedAt: state.lastSyncedAt,
        guestMode: state.guestMode,
      }),
    }
  )
);