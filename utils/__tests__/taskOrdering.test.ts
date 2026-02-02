import { describe, it, expect } from 'vitest';
import {
    getOrderField,
    getSiblings,
    calculateInsertOrder,
    calculateMoveUpDown,
    calculateOrderBetween,
    needsRenormalization,
    renormalizeOrders,
    calculateImportanceOrder,
    calculateClearImportance,
} from '../taskOrdering';
import { Task } from '../../types';

// Helper to create test tasks
const createTask = (overrides: Partial<Task> = {}): Task => ({
    id: crypto.randomUUID(),
    title: 'Test Task',
    completed: false,
    priority: 4,
    tags: [],
    createdAt: Date.now(),
    archived: false,
    ...overrides,
});

describe('taskOrdering utilities', () => {
    describe('getOrderField', () => {
        it('should return order field for project context', () => {
            const result = getOrderField('project');
            expect(result.field).toBe('order');
            expect(result.updateParent).toBe(true);
        });

        it('should return todayOrder field for today context', () => {
            const result = getOrderField('today');
            expect(result.field).toBe('todayOrder');
            expect(result.updateParent).toBe(false);
        });

        it('should return importantOrder field for important context', () => {
            const result = getOrderField('important');
            expect(result.field).toBe('importantOrder');
            expect(result.updateParent).toBe(false);
        });
    });

    describe('getSiblings', () => {
        it('should get siblings for project context (same parent)', () => {
            const parent = createTask({ id: 'parent' });
            const child1 = createTask({ id: 'child1', parentId: 'parent', order: 1000 });
            const child2 = createTask({ id: 'child2', parentId: 'parent', order: 2000 });
            const otherTask = createTask({ id: 'other', parentId: null, order: 100 });

            const siblings = getSiblings(child1, [parent, child1, child2, otherTask], 'project');

            expect(siblings).toHaveLength(2);
            expect(siblings[0].id).toBe('child1');
            expect(siblings[1].id).toBe('child2');
        });

        it('should get important tasks for important context', () => {
            const task1 = createTask({ id: 't1', importantOrder: 1 });
            const task2 = createTask({ id: 't2', importantOrder: 2 });
            const normal = createTask({ id: 'normal' });

            const siblings = getSiblings(task1, [task1, task2, normal], 'important');

            expect(siblings).toHaveLength(2);
            expect(siblings[0].id).toBe('t1');
            expect(siblings[1].id).toBe('t2');
        });

        it('should exclude archived and completed tasks from important', () => {
            const active = createTask({ id: 'active', importantOrder: 1 });
            const archived = createTask({ id: 'archived', importantOrder: 2, archived: true });
            const completed = createTask({ id: 'completed', importantOrder: 3, completed: true });

            const siblings = getSiblings(active, [active, archived, completed], 'important');

            expect(siblings).toHaveLength(1);
        });
    });

    describe('calculateInsertOrder', () => {
        it('should calculate orders when inserting at beginning', () => {
            const existing = [
                createTask({ id: 'a', order: 1000 }),
                createTask({ id: 'b', order: 2000 }),
            ];

            const updates = calculateInsertOrder(existing, 'new', 0, 'order');

            expect(updates['new']).toBe(0);
            expect(updates['a']).toBe(1000);
            expect(updates['b']).toBe(2000);
        });

        it('should calculate orders when inserting in middle', () => {
            const existing = [
                createTask({ id: 'a', order: 1000 }),
                createTask({ id: 'b', order: 2000 }),
            ];

            const updates = calculateInsertOrder(existing, 'new', 1, 'order');

            expect(updates['a']).toBe(0);
            expect(updates['new']).toBe(1000);
            expect(updates['b']).toBe(2000);
        });

        it('should calculate orders when inserting at end', () => {
            const existing = [
                createTask({ id: 'a', order: 1000 }),
                createTask({ id: 'b', order: 2000 }),
            ];

            const updates = calculateInsertOrder(existing, 'new', 2, 'order');

            expect(updates['a']).toBe(0);
            expect(updates['b']).toBe(1000);
            expect(updates['new']).toBe(2000);
        });

        it('should use 1-based ordering for importantOrder', () => {
            const existing = [
                createTask({ id: 'a', importantOrder: 1 }),
            ];

            const updates = calculateInsertOrder(existing, 'new', 1, 'importantOrder');

            expect(updates['a']).toBe(1);
            expect(updates['new']).toBe(2);
        });
    });

    describe('calculateMoveUpDown', () => {
        it('should swap orders when moving up', () => {
            const siblings = [
                createTask({ id: 'a', order: 1000 }),
                createTask({ id: 'b', order: 2000 }),
                createTask({ id: 'c', order: 3000 }),
            ];

            const updates = calculateMoveUpDown(siblings, 'b', 'up', 'order');

            expect(updates).not.toBeNull();
            expect(updates!['a']).toBe(1000); // b moves here
            expect(updates!['b']).toBe(0);    // b swaps with a
        });

        it('should swap orders when moving down', () => {
            const siblings = [
                createTask({ id: 'a', order: 1000 }),
                createTask({ id: 'b', order: 2000 }),
                createTask({ id: 'c', order: 3000 }),
            ];

            const updates = calculateMoveUpDown(siblings, 'b', 'down', 'order');

            expect(updates).not.toBeNull();
            expect(updates!['b']).toBe(2000); // b moves to c's position
            expect(updates!['c']).toBe(1000); // c moves to b's position
        });

        it('should return null when moving first item up', () => {
            const siblings = [
                createTask({ id: 'a', order: 1000 }),
                createTask({ id: 'b', order: 2000 }),
            ];

            const updates = calculateMoveUpDown(siblings, 'a', 'up', 'order');

            expect(updates).toBeNull();
        });

        it('should return null when moving last item down', () => {
            const siblings = [
                createTask({ id: 'a', order: 1000 }),
                createTask({ id: 'b', order: 2000 }),
            ];

            const updates = calculateMoveUpDown(siblings, 'b', 'down', 'order');

            expect(updates).toBeNull();
        });

        it('should return null when task not in siblings', () => {
            const siblings = [
                createTask({ id: 'a', order: 1000 }),
            ];

            const updates = calculateMoveUpDown(siblings, 'unknown', 'up', 'order');

            expect(updates).toBeNull();
        });
    });

    describe('calculateOrderBetween', () => {
        it('should calculate midpoint between two orders', () => {
            expect(calculateOrderBetween(1000, 2000)).toBe(1500);
        });

        it('should calculate order before first (null before)', () => {
            expect(calculateOrderBetween(null, 1000)).toBe(0);
        });

        it('should calculate order after last (null after)', () => {
            expect(calculateOrderBetween(1000, null)).toBe(2000);
        });

        it('should return 0 when both null', () => {
            expect(calculateOrderBetween(null, null)).toBe(0);
        });

        it('should handle close orders', () => {
            expect(calculateOrderBetween(100, 102)).toBe(101);
        });
    });

    describe('needsRenormalization', () => {
        it('should return false for well-spaced orders', () => {
            expect(needsRenormalization([1000, 2000, 3000])).toBe(false);
        });

        it('should return true for tightly packed orders', () => {
            expect(needsRenormalization([100, 102, 104], 10)).toBe(true);
        });

        it('should return false for empty array', () => {
            expect(needsRenormalization([])).toBe(false);
        });

        it('should return false for single item', () => {
            expect(needsRenormalization([1000])).toBe(false);
        });
    });

    describe('renormalizeOrders', () => {
        it('should assign evenly spaced orders', () => {
            const updates = renormalizeOrders(['a', 'b', 'c']);

            expect(updates['a']).toBe(0);
            expect(updates['b']).toBe(1000);
            expect(updates['c']).toBe(2000);
        });

        it('should support custom spacing and base', () => {
            const updates = renormalizeOrders(['a', 'b', 'c'], 100, 50);

            expect(updates['a']).toBe(50);
            expect(updates['b']).toBe(150);
            expect(updates['c']).toBe(250);
        });
    });

    describe('calculateImportanceOrder', () => {
        it('should add to bottom by default', () => {
            const existing = [
                createTask({ id: 'i1', importantOrder: 1 }),
                createTask({ id: 'i2', importantOrder: 2 }),
            ];

            const updates = calculateImportanceOrder(existing, 'new', 'bottom');

            expect(updates['new']).toBe(3);
            expect(updates['i1']).toBe(1);
            expect(updates['i2']).toBe(2);
        });

        it('should add to top and shift others', () => {
            const existing = [
                createTask({ id: 'i1', importantOrder: 1 }),
                createTask({ id: 'i2', importantOrder: 2 }),
            ];

            const updates = calculateImportanceOrder(existing, 'new', 'top');

            expect(updates['new']).toBe(1);
            expect(updates['i1']).toBe(2);
            expect(updates['i2']).toBe(3);
        });

        it('should handle empty list', () => {
            const updates = calculateImportanceOrder([], 'new', 'bottom');

            expect(updates['new']).toBe(1);
        });
    });

    describe('calculateClearImportance', () => {
        it('should clear and shift remaining tasks', () => {
            const existing = [
                createTask({ id: 'i1', importantOrder: 1 }),
                createTask({ id: 'i2', importantOrder: 2 }),
                createTask({ id: 'i3', importantOrder: 3 }),
            ];

            const updates = calculateClearImportance(existing, 'i2');

            expect(updates['i2']).toBeNull();
            expect(updates['i3']).toBe(2); // Shifted from 3 to 2
            expect(updates['i1']).toBeUndefined(); // Not changed
        });

        it('should handle clearing first item', () => {
            const existing = [
                createTask({ id: 'i1', importantOrder: 1 }),
                createTask({ id: 'i2', importantOrder: 2 }),
            ];

            const updates = calculateClearImportance(existing, 'i1');

            expect(updates['i1']).toBeNull();
            expect(updates['i2']).toBe(1); // i2 shifts from 2 to 1
        });

        it('should handle clearing last item', () => {
            const existing = [
                createTask({ id: 'i1', importantOrder: 1 }),
                createTask({ id: 'i2', importantOrder: 2 }),
            ];

            const updates = calculateClearImportance(existing, 'i2');

            expect(updates['i2']).toBeNull();
            expect(updates['i1']).toBeUndefined(); // No shift needed
        });

        it('should return empty for non-existent task', () => {
            const existing = [
                createTask({ id: 'i1', importantOrder: 1 }),
            ];

            const updates = calculateClearImportance(existing, 'unknown');

            expect(Object.keys(updates)).toHaveLength(0);
        });
    });
});
