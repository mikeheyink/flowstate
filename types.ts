export type Priority = 1 | 2 | 3 | 4; // 1 is High, 4 is None

export interface Task {
  id: string;
  parentId?: string | null; // Hierarchy support
  expanded?: boolean; // UI state for hierarchy
  title: string;
  notes?: string; // Markdown notes
  completed: boolean;
  priority: Priority;
  tags: string[];
  dueDate?: Date | null;
  createdAt: number;
  order?: number; // For manual reordering
  archived: boolean;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
  undoAction?: () => void;
}