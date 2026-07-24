/**
 * Task Sorting and Filtering Utilities
 * 
 * These pure functions extract common sorting/filtering logic from TaskList.tsx.
 * All functions are stateless and testable.
 */

import { Task } from '../types';
import { QuadrantKey, quadrantOf, sortQuadrant } from './quad';

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
 * Filter tasks for the Today view (due today or overdue, not completed) and
 * split them into the four Eisenhower quadrants, each sorted by quadOrder.
 */
export function filterTodayQuad(
    tasks: Task[],
    referenceDate: Date = new Date()
): Record<QuadrantKey, Task[]> {
    const endToday = endOfDay(referenceDate);

    const groups: Record<QuadrantKey, Task[]> = { q1: [], q2: [], q3: [], q4: [] };

    tasks.forEach(t => {
        if (t.archived || t.completed || !t.dueDate) return;

        const dDate = startOfDay(new Date(t.dueDate));

        // Due today or overdue
        if (dDate < endToday) {
            groups[quadrantOf(t)].push(t);
        }
    });

    (Object.keys(groups) as QuadrantKey[]).forEach(k => {
        groups[k] = sortQuadrant(groups[k]);
    });

    return groups;
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
 * Sort upcoming tasks: by date, then important first, then by hierarchy
 */
export function sortUpcoming(tasks: Task[], taskMap: Map<string, Task>): Task[] {
    return [...tasks].sort((a, b) => {
        const dA = startOfDay(new Date(a.dueDate!));
        const dB = startOfDay(new Date(b.dueDate!));

        // First by date
        if (dA.getTime() !== dB.getTime()) return dA.getTime() - dB.getTime();

        // Important items first within date
        const isImportantA = !!a.important;
        const isImportantB = !!b.important;
        if (isImportantA !== isImportantB) return isImportantA ? -1 : 1;

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
 *  - Today view    → due today (so it lands in Today immediately).
 *  - Upcoming view → due the same day as the focused task/day-group header.
 *  - Flags         → inherit urgent/important from the focused task, so a task
 *                    created inside a quadrant lands in that same quadrant.
 *
 * The reference is anything carrying a dueDate / flags — a real task, or a
 * synthetic day-group header (which exposes its day via dueDate). A typed
 * date in the input still wins over these defaults (applied in the store).
 */
export function getCreationDefaults(
    filter: ViewFilter,
    reference: { dueDate?: Date | null; urgent?: boolean; important?: boolean } | null,
    referenceDate: Date = new Date()
): { dueDate: Date | null; urgent: boolean; important: boolean } {
    let dueDate: Date | null = null;

    if (filter === 'today') {
        dueDate = startOfDay(referenceDate);
    } else if (filter === 'upcoming' && reference?.dueDate) {
        dueDate = new Date(reference.dueDate);
    }

    return { dueDate, urgent: !!reference?.urgent, important: !!reference?.important };
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
