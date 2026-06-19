import { Task } from '../../types';

export interface DragState {
    type: 'nest' | 'insert-before' | 'insert-after';
    targetId: string;
}

export interface VisibleTask extends Task {
    depth: number;
    hasChildren: boolean;
    isHeader?: boolean;
    effectiveOrder?: number;
    count?: number;
    // For Upcoming day-group headers: the concrete date that group represents.
    bucketDate?: Date;
}

export type ViewFilter = 'active' | 'today' | 'upcoming' | 'review';

export interface TaskListProps {
    filter: ViewFilter;
}
