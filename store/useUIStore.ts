import { create } from 'zustand';

export type FocusMode = 'sidebar' | 'main';
export type QuickAddMode = 'create' | 'date' | 'tag';

interface UIState {
  isCmdOpen: boolean;
  isQuickAddOpen: boolean;
  isShortcutsOpen: boolean;
  quickAddParentId: string | null; // Context for creating subtasks
  quickAddMode: QuickAddMode;
  quickAddTaskId: string | null; // The task being modified (for date/tag mode)

  editingTaskId: string | null; // ID of task currently being renamed

  filter: 'active' | 'today' | 'upcoming';
  focusMode: FocusMode;

  setCmdOpen: (open: boolean) => void;
  setQuickAddOpen: (open: boolean, parentId?: string | null, mode?: QuickAddMode, taskId?: string | null) => void;
  setShortcutsOpen: (open: boolean) => void;
  setEditingTaskId: (id: string | null) => void;
  setFilter: (filter: 'active' | 'today' | 'upcoming') => void;
  setFocusMode: (mode: FocusMode) => void;
  toggleCmd: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isCmdOpen: false,
  isQuickAddOpen: false,
  isShortcutsOpen: false,
  quickAddParentId: null,
  quickAddMode: 'create',
  quickAddTaskId: null,

  editingTaskId: null,

  filter: 'active',
  focusMode: 'main', // Default focus

  setCmdOpen: (open) => set({ isCmdOpen: open }),
  setQuickAddOpen: (open, parentId = null, mode = 'create', taskId = null) =>
    set({ isQuickAddOpen: open, quickAddParentId: parentId, quickAddMode: mode, quickAddTaskId: taskId }),
  setShortcutsOpen: (open) => set({ isShortcutsOpen: open }),
  setEditingTaskId: (id) => set({ editingTaskId: id }),
  setFilter: (filter) => set({ filter }),
  setFocusMode: (mode) => set({ focusMode: mode }),
  toggleCmd: () => set((state) => ({ isCmdOpen: !state.isCmdOpen })),
}));