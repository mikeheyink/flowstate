export type Priority = 1 | 2 | 3 | 4; // 1 is High, 4 is None

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
  order?: number; // For manual reordering
  archived: boolean;
  importantOrder?: number | null;
  todayOrder?: number | null;
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

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
  undoAction?: () => void;
}