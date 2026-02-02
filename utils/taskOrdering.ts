/**
 * Task Ordering Utilities
 * 
 * Pure functions for calculating new order values when tasks are moved.
 * These are extracted from useTaskStore to be testable and reusable.
 */

import { Task } from '../types';

export type OrderContext = 'project' | 'today' | 'important';

export interface OrderField {
    field: keyof Pick<Task, 'order' | 'todayOrder' | 'importantOrder'>;
    updateParent: boolean;
}

/**
 * Determine which order field to use based on context
 */
export function getOrderField(context: OrderContext): OrderField {
    switch (context) {
        case 'today':
            return { field: 'todayOrder', updateParent: false };
        case 'important':
            return { field: 'importantOrder', updateParent: false };
        case 'project':
        default:
            return { field: 'order', updateParent: true };
    }
}

/**
 * Get siblings for a task based on context
 */
export function getSiblings(
    task: Task,
    allTasks: Task[],
    context: OrderContext
): Task[] {
    if (context === 'important') {
        // All tasks with importantOrder set
        return allTasks
            .filter(t => t.importantOrder != null && !t.archived && !t.completed)
            .sort((a, b) => (a.importantOrder || 0) - (b.importantOrder || 0));
    }

    if (context === 'today') {
        // Tasks due today or overdue (not marked important)
        const now = new Date();
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

        return allTasks
            .filter(t => {
                if (t.archived || t.completed || t.importantOrder) return false;
                if (!t.dueDate) return false;
                const d = new Date(t.dueDate);
                return d < endOfToday;
            })
            .sort((a, b) => {
                // Sort by todayOrder if available
                if (a.todayOrder != null && b.todayOrder != null) {
                    return a.todayOrder - b.todayOrder;
                }
                // Fallback: priority then order
                const pDiff = a.priority - b.priority;
                if (pDiff !== 0) return pDiff;
                return (a.order ?? -a.createdAt) - (b.order ?? -b.createdAt);
            });
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
    insertIndex: number,
    orderField: keyof Task = 'order'
): Record<string, number> {
    const updates: Record<string, number> = {};

    // Create new list with task inserted
    const newList = [...existingSiblings];
    // The new task needs to be tracked by ID
    newList.splice(insertIndex, 0, { id: newTaskId } as Task);

    // Normalize all orders
    const spacing = orderField === 'importantOrder' ? 1 : 1000;
    const base = orderField === 'importantOrder' ? 1 : 0;

    newList.forEach((t, i) => {
        updates[t.id] = base + (i * spacing);
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
    direction: 'up' | 'down',
    orderField: keyof Pick<Task, 'order' | 'todayOrder' | 'importantOrder'> = 'order'
): Record<string, number> | null {
    const currentIndex = siblings.findIndex(t => t.id === taskId);
    if (currentIndex === -1) return null;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return null;

    // Calculate orders
    const updates: Record<string, number> = {};
    const spacing = orderField === 'importantOrder' ? 1 : 1000;
    const base = orderField === 'importantOrder' ? 1 : 0;

    // Normalize all siblings first
    siblings.forEach((t, i) => {
        updates[t.id] = base + (i * spacing);
    });

    // Swap the two positions
    const currentTask = siblings[currentIndex];
    const targetTask = siblings[targetIndex];

    updates[currentTask.id] = base + (targetIndex * spacing);
    updates[targetTask.id] = base + (currentIndex * spacing);

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

/**
 * Calculate updates for adding a task to the important list
 */
export function calculateImportanceOrder(
    existingImportant: Task[],
    taskId: string,
    position: 'top' | 'bottom' = 'bottom'
): Record<string, number> {
    const updates: Record<string, number> = {};

    // Sort existing by importantOrder
    const sorted = [...existingImportant].sort(
        (a, b) => (a.importantOrder || 0) - (b.importantOrder || 0)
    );

    if (position === 'top') {
        // Shift all existing down
        sorted.forEach((t, i) => {
            updates[t.id] = i + 2; // Start from 2
        });
        updates[taskId] = 1;
    } else {
        // Existing stay the same, new task at end
        sorted.forEach((t, i) => {
            updates[t.id] = i + 1;
        });
        updates[taskId] = sorted.length + 1;
    }

    return updates;
}

/**
 * Calculate updates for removing from important list
 */
export function calculateClearImportance(
    existingImportant: Task[],
    removedTaskId: string
): Record<string, number | null> {
    const updates: Record<string, number | null> = {};
    const task = existingImportant.find(t => t.id === removedTaskId);

    if (!task?.importantOrder) return updates;

    const removedOrder = task.importantOrder;
    updates[removedTaskId] = null;

    // Shift up all tasks after the removed one
    existingImportant
        .filter(t => t.importantOrder && t.importantOrder > removedOrder && t.id !== removedTaskId)
        .forEach(t => {
            updates[t.id] = (t.importantOrder || 0) - 1;
        });

    return updates;
}
