/**
 * Task Ordering Utilities
 *
 * Pure functions for calculating new order values when tasks are moved.
 * These are extracted from useTaskStore to be testable and reusable.
 *
 * Two ordering worlds exist and never touch each other:
 *  - 'project': the Plan hierarchy (`order` + parentId)
 *  - 'quad':    position within a task's current Eisenhower quadrant
 *               (`quadOrder`; quadrant membership derives from urgent/important)
 */

import { Task } from '../types';
import { quadrantOf, sortQuadrant } from './quad';

export type OrderContext = 'project' | 'quad';

export interface OrderField {
    field: keyof Pick<Task, 'order' | 'quadOrder'>;
    updateParent: boolean;
}

/**
 * Determine which order field to use based on context
 */
export function getOrderField(context: OrderContext): OrderField {
    switch (context) {
        case 'quad':
            return { field: 'quadOrder', updateParent: false };
        case 'project':
        default:
            return { field: 'order', updateParent: true };
    }
}

/**
 * Get siblings for a task based on context.
 *
 * 'quad' siblings are the *other members of the same quadrant* among tasks due
 * today or overdue — moving with ⌘↑/⌘↓ stays inside the quadrant; the flags
 * (u/i) are the only way to cross into another one.
 */
export function getSiblings(
    task: Task,
    allTasks: Task[],
    context: OrderContext
): Task[] {
    if (context === 'quad') {
        const now = new Date();
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const quadrant = quadrantOf(task);

        const members = allTasks.filter(t => {
            if (t.archived || t.completed || !t.dueDate) return false;
            if (quadrantOf(t) !== quadrant) return false;
            return new Date(t.dueDate) < endOfToday;
        });

        return sortQuadrant(members);
    }

    // Project context: same parent, same completion status
    return allTasks
        .filter(t =>
            t.parentId === (task.parentId || null) &&
            t.completed === task.completed &&
            !t.archived
        )
        .sort((a, b) => (a.order ?? -a.createdAt) - (b.order ?? -b.createdAt));
}

/**
 * Calculate order updates after inserting a task at a specific position
 * Returns a map of taskId -> newOrderValue
 */
export function calculateInsertOrder(
    existingSiblings: Task[],
    newTaskId: string,
    insertIndex: number
): Record<string, number> {
    const updates: Record<string, number> = {};

    // Create new list with task inserted
    const newList = [...existingSiblings];
    // The new task needs to be tracked by ID
    newList.splice(insertIndex, 0, { id: newTaskId } as Task);

    // Normalize all orders
    newList.forEach((t, i) => {
        updates[t.id] = i * 1000;
    });

    return updates;
}

/**
 * Calculate order updates after moving a task up or down
 * Returns a map of taskId -> newOrderValue (only for changed tasks)
 */
export function calculateMoveUpDown(
    siblings: Task[],
    taskId: string,
    direction: 'up' | 'down'
): Record<string, number> | null {
    const currentIndex = siblings.findIndex(t => t.id === taskId);
    if (currentIndex === -1) return null;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return null;

    // Calculate orders
    const updates: Record<string, number> = {};

    // Normalize all siblings first
    siblings.forEach((t, i) => {
        updates[t.id] = i * 1000;
    });

    // Swap the two positions
    const currentTask = siblings[currentIndex];
    const targetTask = siblings[targetIndex];

    updates[currentTask.id] = targetIndex * 1000;
    updates[targetTask.id] = currentIndex * 1000;

    return updates;
}

/**
 * Calculate order for inserting between two tasks (or at edges)
 * Uses midpoint strategy for efficiency
 */
export function calculateOrderBetween(
    beforeOrder: number | null,
    afterOrder: number | null,
    spacing: number = 1000
): number {
    if (beforeOrder == null && afterOrder == null) {
        return 0;
    }

    if (beforeOrder == null) {
        return afterOrder! - spacing;
    }

    if (afterOrder == null) {
        return beforeOrder + spacing;
    }

    return Math.floor((beforeOrder + afterOrder) / 2);
}

/**
 * Check if orders need renormalization (too close together)
 */
export function needsRenormalization(orders: number[], minGap: number = 10): boolean {
    const sorted = [...orders].sort((a, b) => a - b);

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i - 1] < minGap) {
            return true;
        }
    }

    return false;
}

/**
 * Renormalize a list of task orders with consistent spacing
 */
export function renormalizeOrders(
    taskIds: string[],
    spacing: number = 1000,
    base: number = 0
): Record<string, number> {
    const updates: Record<string, number> = {};

    taskIds.forEach((id, i) => {
        updates[id] = base + (i * spacing);
    });

    return updates;
}
