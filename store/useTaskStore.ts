import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Task, Priority } from '../types';
import { parseTaskInput } from '../utils/nlp';
import { supabase } from '../utils/supabase';

const generateId = () => Math.random().toString(36).substring(2, 9);

// Pending operation types for offline queue
interface PendingOperation {
  id: string;
  type: 'insert' | 'update' | 'delete';
  table: string;
  data?: any;
  taskId?: string;
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

  // Actions
  fetchTasks: () => Promise<void>;
  addTask: (rawInput: string, parentId?: string | null, afterTaskId?: string | null) => void;
  batchAddTasks: (rawInputs: string[]) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  moveTask: (id: string, direction: 'up' | 'down') => void;

  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  archiveTask: (id: string) => void;
  setPriority: (id: string, priority: Priority) => void;
  setFocusedId: (id: string | null) => void;
  setGuestMode: (isGuest: boolean) => void;
  setError: (error: string | null) => void;

  // Hierarchy Actions
  toggleExpand: (id: string) => void;
  setExpandedAll: (expanded: boolean) => void;
  changeParent: (id: string, newParentId: string | null) => void;
  moveTaskTo: (id: string, newParentId: string | null, newOrder: number) => void;

  undo: () => void;
  redo: () => void;
  setTasks: (tasks: Task[]) => void;

  // Sync actions
  processPendingOperations: () => Promise<void>;
  getPendingCount: () => number;
}

// Helper to map DB snake_case to App camelCase
const mapFromDb = (dbTask: any): Task => ({
  id: dbTask.id,
  parentId: dbTask.parent_id,
  title: dbTask.title,
  notes: dbTask.notes,
  completed: dbTask.completed,
  priority: dbTask.priority as Priority,
  tags: dbTask.tags || [],
  dueDate: dbTask.due_date ? new Date(dbTask.due_date) : null,
  createdAt: parseInt(dbTask.created_at),
  order: parseFloat(dbTask.order),
  expanded: dbTask.expanded,
  archived: dbTask.archived
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

      addTask: async (rawInput, parentId = null, afterTaskId = null) => {
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

        // 3. DB Sync
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

      updateTask: async (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates } : t),
        }));

        const state = get();
        if (state.guestMode) return;

        await supabase.from('tasks').update(mapToDb(updates)).eq('id', id);
      },

      moveTask: async (id: string, direction: 'up' | 'down') => {
        const state = get();
        const task = state.tasks.find(t => t.id === id);
        if (!task) return;

        const siblings = state.tasks.filter(t =>
          t.parentId === (task.parentId || null) &&
          t.completed === task.completed &&
          !t.archived
        );

        siblings.sort((a, b) => {
          const orderA = a.order ?? -a.createdAt;
          const orderB = b.order ?? -b.createdAt;
          return orderA - orderB;
        });

        const currentIndex = siblings.findIndex(t => t.id === id);
        if (currentIndex === -1) return;

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= siblings.length) return;

        const updates: Record<string, number> = {};
        siblings.forEach((t, i) => { updates[t.id] = i * 1000; });

        const id1 = siblings[currentIndex].id;
        const id2 = siblings[targetIndex].id;

        // Swap
        const temp = updates[id1];
        updates[id1] = updates[id2];
        updates[id2] = temp;

        set((state) => ({
          tasks: state.tasks.map(t => updates[t.id] !== undefined ? { ...t, order: updates[t.id] } : t)
        }));

        if (state.guestMode) return;

        await supabase.from('tasks').update({ order: updates[id1] }).eq('id', id1);
        await supabase.from('tasks').update({ order: updates[id2] }).eq('id', id2);
      },

      changeParent: async (id, newParentId) => {
        set((state) => ({
          tasks: state.tasks.map(t => t.id === id ? { ...t, parentId: newParentId } : t)
        }));

        const state = get();
        if (state.guestMode) return;

        await supabase.from('tasks').update({ parent_id: newParentId }).eq('id', id);
      },

      moveTaskTo: async (id: string, newParentId: string | null, newOrder: number) => {
        set((state) => ({
          tasks: state.tasks.map(t => t.id === id ? { ...t, parentId: newParentId, order: newOrder } : t)
        }));

        const state = get();
        if (state.guestMode) return;

        await supabase.from('tasks').update({
          parent_id: newParentId,
          order: newOrder
        }).eq('id', id);
      },

      toggleTask: async (id) => {
        const state = get();
        const task = state.tasks.find(t => t.id === id);
        if (!task) return;
        const newVal = !task.completed;

        set((state) => {
          return {
            tasks: state.tasks.map((t) => t.id === id ? { ...t, completed: newVal } : t),
          };
        });

        if (state.guestMode) return;
        await supabase.from('tasks').update({ completed: newVal }).eq('id', id);
      },

      deleteTask: async (id) => {
        // Simple optimistic delete
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id && t.parentId !== id),
        }));

        const state = get();
        if (state.guestMode) return;

        await supabase.from('tasks').delete().eq('id', id);
        // Supabase cascade delete handles children if configured, but here we do simple
      },

      archiveTask: async (id) => {
        set((state) => ({
          tasks: state.tasks.map((t) => t.id === id ? { ...t, archived: true } : t),
        }));

        const state = get();
        if (state.guestMode) return;

        await supabase.from('tasks').update({ archived: true }).eq('id', id);
      },

      setPriority: async (id, priority) => {
        set((state) => ({
          tasks: state.tasks.map((t) => t.id === id ? { ...t, priority } : t),
        }));

        const state = get();
        if (state.guestMode) return;

        await supabase.from('tasks').update({ priority }).eq('id', id);
      },

      setFocusedId: (id) => set({ focusedId: id }),

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

      undo: () => {
        // Undo with Database is complex. For MVP, we'll rely on simple Revert logic 
        // or disable it until a robust Command pattern is implemented.
        // Disabling strictly for now as it conflicts with Async nature.
        console.warn("Undo not fully supported in Async/DB mode yet.");
      },

      redo: () => {
        console.warn("Redo not fully supported in Async/DB mode yet.");
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