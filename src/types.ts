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

  // The "why": which objective(s) this habit serves (stacked colored edge in
  // the views + per-objective analytics rollup) and an optional detail
  // (multi-line) revealed in a hover/tap card. Both optional — a habit without
  // them renders as before. A habit can serve several objectives at once.
  objectiveIds?: string[];
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
  essence: string; // one-line north star — always visible; what the daily soft-start surfaces
  body: string; // markdown detail — meaning, sub-points, commitments
  color: string; // hex; this objective's accent across the app
  order: number; // manual sort key (lower = higher on the page)
  createdAt: number;
  archivedAt: number | null; // soft-delete
}

// Adventure — a calm page that turns the "Adventure" objective into something
// lived: adventures lined up on the calendar + seeds of future ones.
//   date === null  → a seed (someday, undated) — the Seedbed
//   date in future → scheduled — the Horizon
//   lived, or date in the past → the memory log (Looking Back)
export interface Adventure {
  id: string;
  title: string;
  notes: string; // optional detail (markdown-lite)
  categoryId: string | null; // soft ref to AdventureCategory.id
  date: number | null; // epoch ms of the scheduled day; null = seed
  lived: boolean; // explicitly marked lived (past-dated ones read as lived too)
  externalEventId: string | null; // reserved: future Google Calendar sync
  order: number; // manual sort key within the Seedbed (lower = higher)
  createdAt: number;
  archivedAt: number | null; // soft-delete
}

// A kind of adventure — a coloured tag. Ships with an editable preset.
export interface AdventureCategory {
  id: string;
  label: string;
  color: string; // hex accent
  order: number;
  createdAt: number;
  archivedAt: number | null;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
  undoAction?: () => void;
}