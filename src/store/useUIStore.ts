import { create } from 'zustand';

export type FocusMode = 'sidebar' | 'main';
export type QuickAddMode = 'create' | 'date' | 'tag';
export type CurrentView = 'tasks' | 'mail' | 'habits';
export type HabitView = 'grid' | 'checklist' | 'analytics';

interface UIState {
  isCmdOpen: boolean;
  isQuickAddOpen: boolean;
  isShortcutsOpen: boolean;
  quickAddParentId: string | null;
  quickAddMode: QuickAddMode;
  quickAddTaskId: string | null;
  editingTaskId: string | null;
  filter: 'active' | 'today' | 'upcoming' | 'review';
  focusMode: FocusMode;
  currentView: CurrentView;
  habitView: HabitView;
  globalHabitGoal: number; // percentage, e.g., 80 for 80%

  // UI-only expansion state for headers
  expandedGroups: Set<string>;
  toggleGroup: (id: string) => void;

  setCmdOpen: (open: boolean) => void;
  setQuickAddOpen: (open: boolean, parentId?: string | null, mode?: QuickAddMode, taskId?: string | null) => void;
  setShortcutsOpen: (open: boolean) => void;
  setEditingTaskId: (id: string | null) => void;
  setFilter: (filter: 'active' | 'today' | 'upcoming' | 'review') => void;
  setFocusMode: (mode: FocusMode) => void;
  setCurrentView: (view: CurrentView) => void;
  setHabitView: (view: HabitView) => void;
  setGlobalHabitGoal: (goal: number) => void;
  toggleCmd: () => void;
  cycleHabitView: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isCmdOpen: false,
  isQuickAddOpen: false,
  isShortcutsOpen: false,
  quickAddParentId: null,
  quickAddMode: 'create',
  quickAddTaskId: null,
  editingTaskId: null,
  filter: 'today',
  focusMode: 'main',
  currentView: 'tasks',
  habitView: 'grid',
  globalHabitGoal: 80,

  expandedGroups: new Set(['header-important', 'header-outstanding']),
  toggleGroup: (id) => set((state) => {
    const next = new Set(state.expandedGroups);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return { expandedGroups: next };
  }),

  setCmdOpen: (open) => set({ isCmdOpen: open }),
  setQuickAddOpen: (open, parentId = null, mode = 'create', taskId = null) =>
    set({ isQuickAddOpen: open, quickAddParentId: parentId, quickAddMode: mode, quickAddTaskId: taskId }),
  setShortcutsOpen: (open) => set({ isShortcutsOpen: open }),
  setEditingTaskId: (id) => set({ editingTaskId: id }),
  setFilter: (filter) => set({ filter }),
  setFocusMode: (mode) => set({ focusMode: mode }),
  setCurrentView: (view) => set({ currentView: view }),
  setHabitView: (view) => set({ habitView: view }),
  setGlobalHabitGoal: (goal) => set({ globalHabitGoal: goal }),
  toggleCmd: () => set((state) => ({ isCmdOpen: !state.isCmdOpen })),
  cycleHabitView: () => set((state) => {
    const views: HabitView[] = ['grid', 'checklist', 'analytics'];
    const currentIndex = views.indexOf(state.habitView);
    const nextIndex = (currentIndex + 1) % views.length;
    return { habitView: views[nextIndex] };
  }),
}));