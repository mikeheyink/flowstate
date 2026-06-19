/**
 * Task Sorting and Filtering Utilities
 * 
 * These pure functions extract common sorting/filtering logic from TaskList.tsx.
 * All functions are stateless and testable.
 */

import { Task } from '../types';

// VisibleTask extends Task with UI-specific properties
export interface VisibleTask extends Task {
    depth: number;
    hasChildren: boolean;
    isHeader?: boolean;
    count?: number;
    effectiveOrder?: number;
    // For Upcoming day-group headers: the concrete date that group represents
    // (the earliest task's date in the bucket). Lets "add a task while focused on
    // a day header" pre-fill that day as the due date.
    bucketDate?: Date;
}

export type ViewFilter = 'active' | 'today' | 'upcoming' | 'review';

// ============================================================================
// HIERARCHY UTILITIES
// ============================================================================

/**
 * Create a map of task IDs to tasks for O(1) lookups
 */
export function buildTaskMap(tasks: Task[]): Map<string, Task> {
    const map = new Map<string, Task>();
    tasks.forEach(t => map.set(t.id, t));
    return map;
}

/**
 * Get the sort path for a task (list of orders from root to task)
 * Used for hierarchical sorting to maintain parent-child relationships
 */
export function getSortPath(task: Task, taskMap: Map<string, Task>): number[] {
    const path: number[] = [];
    let current: Task | undefined = task;

    while (current) {
        // Use order or negative createdAt for stability
        path.unshift(current.order ?? -current.createdAt);
        if (current.parentId) {
            current = taskMap.get(current.parentId);
        } else {
            current = undefined;
        }
    }

    return path;
}

/**
 * Compare two tasks by their hierarchy path
 * Returns negative if a should come before b, positive if after, 0 if equal
 */
export function compareHierarchy(a: Task, b: Task, taskMap: Map<string, Task>): number {
    const pathA = getSortPath(a, taskMap);
    const pathB = getSortPath(b, taskMap);
    const len = Math.min(pathA.length, pathB.length);

    for (let i = 0; i < len; i++) {
        if (pathA[i] !== pathB[i]) return pathA[i] - pathB[i];
    }

    return pathA.length - pathB.length;
}

/**
 * Build a map of parent IDs to their children
 */
export function buildChildrenMap(tasks: Task[]): Map<string, Task[]> {
    const childrenMap = new Map<string, Task[]>();

    // Sort siblings first by order
    const sorted = [...tasks].sort((a, b) => (a.order ?? -a.createdAt) - (b.order ?? -b.createdAt));

    sorted.forEach(t => {
        const pid = t.parentId || 'root';
        if (!childrenMap.has(pid)) childrenMap.set(pid, []);
        childrenMap.get(pid)!.push(t);
    });

    return childrenMap;
}

/**
 * Recursively flatten a tree into a list with depth information
 */
export function flattenTree(
    childrenMap: Map<string, Task[]>,
    parentId: string | null = null,
    depth: number = 0,
    result: VisibleTask[] = []
): VisibleTask[] {
    const children = childrenMap.get(parentId || 'root');
    if (!children) return result;

    for (const child of children) {
        const hasChildren = childrenMap.has(child.id) && (childrenMap.get(child.id)?.length || 0) > 0;
        result.push({ ...child, depth, hasChildren });

        if (child.expanded && hasChildren) {
            flattenTree(childrenMap, child.id, depth + 1, result);
        }
    }

    return result;
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Get start of day (midnight) for a date
 */
export function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Get end of day (start of next day) for a date
 */
export function endOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

/**
 * Get the bucket name for a date in the Upcoming view
 */
export function getUpcomingBucketName(date: Date, referenceDate: Date = new Date()): string {
    const d = startOfDay(date);
    const today = startOfDay(referenceDate);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Tomorrow?
    if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';

    // Next 7 days?
    const diffDays = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
        return d.toLocaleDateString('en-US', { weekday: 'long' });
    }

    // Future - group by month
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ============================================================================
// VIEW FILTERS
// ============================================================================

/**
 * Filter tasks for the Active (Inbox) view
 */
export function filterActive(tasks: Task[]): Task[] {
    return tasks.filter(t => !t.archived && !t.completed);
}

/**
 * Filter tasks for the Today view (due today or overdue, not completed)
 */
export function filterToday(tasks: Task[], referenceDate: Date = new Date()): {
    important: Task[];
    outstanding: Task[];
} {
    const endToday = endOfDay(referenceDate);

    const important: Task[] = [];
    const outstanding: Task[] = [];

    tasks.forEach(t => {
        if (t.archived || t.completed || !t.dueDate) return;

        const dDate = startOfDay(new Date(t.dueDate));

        // Due today or overdue
        if (dDate < endToday) {
            if (t.importantOrder) {
                important.push(t);
            } else {
                outstanding.push(t);
            }
        }
    });

    return { important, outstanding };
}

/**
 * Filter tasks for the Upcoming view (due tomorrow onwards)
 */
export function filterUpcoming(tasks: Task[], referenceDate: Date = new Date()): Task[] {
    const endToday = endOfDay(referenceDate);

    return tasks.filter(t => {
        if (t.archived || t.completed || !t.dueDate) return false;
        const d = new Date(t.dueDate);
        return d >= endToday;
    });
}

// ============================================================================
// VIEW SORTERS
// ============================================================================

/**
 * Sort important tasks by their importantOrder
 */
export function sortImportant(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => (a.importantOrder || 0) - (b.importantOrder || 0));
}

/**
 * Sort outstanding tasks for Today view
 * Tasks with todayOrder are sorted by that, others are placed after
 */
export function sortOutstandingForToday(
    tasks: Task[],
    referenceDate: Date = new Date()
): VisibleTask[] {
    const startToday = startOfDay(referenceDate);

    const hasOrder = (t: Task) => t.todayOrder !== undefined && t.todayOrder !== null;

    const withOrder = tasks.filter(hasOrder);
    const withoutOrder = tasks.filter(t => !hasOrder(t));

    // Sort unordered: overdue first, then by createdAt
    withoutOrder.sort((a, b) => {
        const dateA = new Date(a.dueDate!);
        const dateB = new Date(b.dueDate!);
        const isOverdueA = dateA < startToday;
        const isOverdueB = dateB < startToday;

        if (isOverdueA !== isOverdueB) return isOverdueA ? -1 : 1;
        return a.createdAt - b.createdAt;
    });

    // Sort ordered tasks by todayOrder
    withOrder.sort((a, b) => (a.todayOrder || 0) - (b.todayOrder || 0));

    // Calculate effective order for all tasks
    const maxOrder = withOrder.length > 0
        ? Math.max(...withOrder.map(t => t.todayOrder || 0))
        : 0;

    const orderedVisible: VisibleTask[] = withOrder.map(t => ({
        ...t,
        depth: 0,
        hasChildren: false,
        effectiveOrder: t.todayOrder!
    }));

    const unorderedVisible: VisibleTask[] = withoutOrder.map((t, i) => ({
        ...t,
        depth: 0,
        hasChildren: false,
        effectiveOrder: maxOrder + ((i + 1) * 10000)
    }));

    const result = [...orderedVisible, ...unorderedVisible];
    result.sort((a, b) => (a.effectiveOrder || 0) - (b.effectiveOrder || 0));

    return result;
}

/**
 * Sort upcoming tasks: by date, then important first, then by hierarchy
 */
export function sortUpcoming(tasks: Task[], taskMap: Map<string, Task>): Task[] {
    return [...tasks].sort((a, b) => {
        const dA = startOfDay(new Date(a.dueDate!));
        const dB = startOfDay(new Date(b.dueDate!));

        // First by date
        if (dA.getTime() !== dB.getTime()) return dA.getTime() - dB.getTime();

        // Important items first within date
        const isImportantA = !!a.importantOrder;
        const isImportantB = !!b.importantOrder;
        if (isImportantA !== isImportantB) return isImportantA ? -1 : 1;

        if (isImportantA && isImportantB) {
            return (a.importantOrder || 0) - (b.importantOrder || 0);
        }

        return compareHierarchy(a, b, taskMap);
    });
}

/**
 * Group tasks by their bucket name
 */
export function groupByBucket(
    tasks: Task[],
    getBucket: (t: Task) => string
): Map<string, Task[]> {
    const groups = new Map<string, Task[]>();

    tasks.forEach(t => {
        const bucket = getBucket(t);
        if (!groups.has(bucket)) groups.set(bucket, []);
        groups.get(bucket)!.push(t);
    });

    return groups;
}

/**
 * Compute the default field values a newly-created task should inherit from the
 * view it's being added in and the row that was focused at the time.
 *
 *  - Today view   → due today (so it lands in Today immediately).
 *  - Upcoming view → due the same day as the focused task/day-group header.
 *  - Important     → inherit the important flag from the focused task.
 *
 * The reference is anything carrying a dueDate / importantOrder — a real task,
 * or a synthetic day-group header (which exposes its day via dueDate). A typed
 * date in the input still wins over these defaults (applied in the store).
 */
export function getCreationDefaults(
    filter: ViewFilter,
    reference: { dueDate?: Date | null; importantOrder?: number | null } | null,
    referenceDate: Date = new Date()
): { dueDate: Date | null; important: boolean } {
    let dueDate: Date | null = null;

    if (filter === 'today') {
        dueDate = startOfDay(referenceDate);
    } else if (filter === 'upcoming' && reference?.dueDate) {
        dueDate = new Date(reference.dueDate);
    }

    return { dueDate, important: !!reference?.importantOrder };
}

/**
 * Create section header for grouped views
 */
export function createSectionHeader(
    id: string,
    title: string,
    count: number
): VisibleTask {
    return {
        id,
        title,
        depth: 0,
        hasChildren: false,
        isHeader: true,
        completed: false,
        count,
        // Required Task fields with defaults
        priority: 4,
        tags: [],
        createdAt: 0,
        archived: false,
    } as VisibleTask;
}
