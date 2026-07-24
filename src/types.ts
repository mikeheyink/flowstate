export type Priority = 1 | 2 | 3 | 4; // Legacy field — no longer surfaced in the UI (Eisenhower flags replaced it)

export interface Task {
  id: string;
  parentId?: string | null; // Hierarchy support
  expanded?: boolean; // UI state for hierarchy
  title: string;
  notes?: string; // Markdown notes
  completed: boolean;
  completedAt?: Date | null; // When task was completed
  priority: Priority;
  tags: string[];
  dueDate?: Date | null;
  createdAt: number;
  order?: number; // For manual reordering (Plan hierarchy)
  archived: boolean;

  // Eisenhower flags — both manual, both independent of due date.
  // urgent  = real time pressure (deadline, someone blocked, closing window)
  // important = advances an objective / compounding long-term consequence
  urgent?: boolean;
  important?: boolean;
  // Manual position within the current quadrant of the Today quad view.
  // Fully independent of `order` (Plan hierarchy) — quad moves never touch Plan.
  quadOrder?: number | null;
}

export type HabitType = 'do' | 'dont-do';

export interface Habit {
  id: string;
  title: string;
  type: HabitType;
  createdAt: number;
  archivedAt: number | null; // soft-delete
  order: number; // manual sort key (lower = higher in the list)

  // Recurrence: habit applies for specific days of week
  appliesFromWeek: string; // ISO week "2026-W24"
  appliesUntilWeek: string | null; // null = all future weeks
  daysOfWeek: number[]; // 0=Monday, 6=Sunday

  // The "why": which objective this habit serves (colored left edge in the
  // views + per-objective analytics rollup) and an optional one-line reason
  // revealed on hover. Both optional — a habit without them renders as before.
  objectiveId?: string | null;
  why?: string;
}

// Three-state daily outcome for a habit:
//  - 'pending' = not yet evaluated (the default; excluded from success-rate stats)
//  - 'done'    = tick / succeeded
//  - 'failed'  = cross / failed
export type HabitStatus = 'pending' | 'done' | 'failed';

export interface HabitLog {
  id: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  status: HabitStatus;
  updatedAt: number;
}

// A life objective — the "why" layer above tasks and habits.
// Deliberately light: no spine linking everything, just a calm page that
// resurfaces the values (and colors that thread through habits/analytics).
export interface Objective {
  id: string;
  title: string;
  body: string; // free text — the objective's meaning, sub-points, commitments
  color: string; // hex; this objective's accent across the app
  order: number; // manual sort key (lower = higher on the page)
  createdAt: number;
  archivedAt: number | null; // soft-delete
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
  undoAction?: () => void;
}