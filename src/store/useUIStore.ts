import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FocusMode = 'sidebar' | 'main';
export type QuickAddMode = 'create' | 'date' | 'tag';
export interface QuickAddDefaults {
  dueDate?: Date | null;
  important?: boolean;
}
export type CurrentView = 'tasks' | 'mail' | 'habits';
export type HabitView = 'grid' | 'checklist' | 'analytics';

interface UIState {
  isCmdOpen: boolean;
  isQuickAddOpen: boolean;
  isShortcutsOpen: boolean;
  quickAddParentId: string | null;
  quickAddMode: QuickAddMode;
  quickAddTaskId: string | null;
  // Field values a task created via Quick Add should inherit from the view/row it
  // was opened from (due date, importance). Null when there's nothing to inherit.
  quickAddDefaults: QuickAddDefaults | null;
  editingTaskId: string | null;
  filter: 'active' | 'today' | 'upcoming' | 'review';
  focusMode: FocusMode;
  currentView: CurrentView;
  habitView: HabitView;
  globalHabitGoal: number; // percentage, e.g., 80 for 80%

  // Habit add/edit form. Lives here (not in HabitsView) so the command palette
  // and global hotkeys can open it, and so keyboard handlers can tell when a
  // modal is up and suppress grid navigation behind it.
  habitForm: { open: boolean; editingId: string | null };

  // UI-only expansion state for headers
  expandedGroups: Set<string>;
  toggleGroup: (id: string) => void;

  setCmdOpen: (open: boolean) => void;
  setQuickAddOpen: (open: boolean, parentId?: string | null, mode?: QuickAddMode, taskId?: string | null, defaults?: QuickAddDefaults | null) => void;
  setShortcutsOpen: (open: boolean) => void;
  setEditingTaskId: (id: string | null) => void;
  setFilter: (filter: 'active' | 'today' | 'upcoming' | 'review') => void;
  setFocusMode: (mode: FocusMode) => void;
  setCurrentView: (view: CurrentView) => void;
  setHabitView: (view: HabitView) => void;
  setGlobalHabitGoal: (goal: number) => void;
  toggleCmd: () => void;
  cycleHabitView: (dir?: 'next' | 'prev') => void;
  openNewHabit: () => void;
  openEditHabit: (id: string) => void;
  closeHabitForm: () => void;

  // True when any modal/overlay owns keyboard focus — used to suppress
  // section/grid hotkeys so they don't fire "behind" the overlay.
  isAnyOverlayOpen: () => boolean;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
  isCmdOpen: false,
  isQuickAddOpen: false,
  isShortcutsOpen: false,
  quickAddParentId: null,
  quickAddMode: 'create',
  quickAddTaskId: null,
  quickAddDefaults: null,
  editingTaskId: null,
  filter: 'today',
  focusMode: 'main',
  currentView: 'tasks',
  habitView: 'grid',
  globalHabitGoal: 80,
  habitForm: { open: false, editingId: null },

  expandedGroups: new Set(['header-important', 'header-outstanding']),
  toggleGroup: (id) => set((state) => {
    const next = new Set(state.expandedGroups);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return { expandedGroups: next };
  }),

  setCmdOpen: (open) => set({ isCmdOpen: open }),
  setQuickAddOpen: (open, parentId = null, mode = 'create', taskId = null, defaults = null) =>
    set({ isQuickAddOpen: open, quickAddParentId: parentId, quickAddMode: mode, quickAddTaskId: taskId, quickAddDefaults: defaults }),
  setShortcutsOpen: (open) => set({ isShortcutsOpen: open }),
  setEditingTaskId: (id) => set({ editingTaskId: id }),
  setFilter: (filter) => set({ filter }),
  setFocusMode: (mode) => set({ focusMode: mode }),
  setCurrentView: (view) => set({ currentView: view }),
  setHabitView: (view) => set({ habitView: view }),
  setGlobalHabitGoal: (goal) => set({ globalHabitGoal: goal }),
  toggleCmd: () => set((state) => ({ isCmdOpen: !state.isCmdOpen })),
  cycleHabitView: (dir = 'next') => set((state) => {
    const views: HabitView[] = ['grid', 'checklist', 'analytics'];
    const currentIndex = views.indexOf(state.habitView);
    const delta = dir === 'next' ? 1 : -1;
    const nextIndex = (currentIndex + delta + views.length) % views.length;
    return { habitView: views[nextIndex] };
  }),
  openNewHabit: () => set({ habitForm: { open: true, editingId: null } }),
  openEditHabit: (id) => set({ habitForm: { open: true, editingId: id } }),
  closeHabitForm: () => set({ habitForm: { open: false, editingId: null } }),

  isAnyOverlayOpen: () => {
    const s = get();
    return s.isCmdOpen || s.isShortcutsOpen || s.isQuickAddOpen || s.habitForm.open;
  },
    }),
    {
      name: 'flowstate-ui',
      // Persist only "where am I" navigation state — NOT transient modal/edit
      // flags — so a refresh keeps you in the section/filter you were in instead
      // of snapping back to Tasks/Today.
      partialize: (state) => ({
        currentView: state.currentView,
        filter: state.filter,
        habitView: state.habitView,
        globalHabitGoal: state.globalHabitGoal,
      }),
    }
  )
);