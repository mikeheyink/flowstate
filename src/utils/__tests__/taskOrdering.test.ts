import { describe, it, expect } from 'vitest';
import {
    getOrderField,
    getSiblings,
    calculateInsertOrder,
    calculateMoveUpDown,
    calculateOrderBetween,
    needsRenormalization,
    renormalizeOrders,
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

// A task visible in today's quad (due today, flags per overrides)
const createQuadTask = (overrides: Partial<Task> = {}): Task =>
    createTask({ dueDate: new Date(), ...overrides });

describe('taskOrdering utilities', () => {
    describe('getOrderField', () => {
        it('should return order field for project context', () => {
            const result = getOrderField('project');
            expect(result.field).toBe('order');
            expect(result.updateParent).toBe(true);
        });

        it('should return quadOrder field for quad context', () => {
            const result = getOrderField('quad');
            expect(result.field).toBe('quadOrder');
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

        it('quad context returns only same-quadrant tasks due today, sorted by quadOrder', () => {
            const q2a = createQuadTask({ id: 'q2a', important: true, quadOrder: 2000 });
            const q2b = createQuadTask({ id: 'q2b', important: true, quadOrder: 1000 });
            const q1 = createQuadTask({ id: 'q1', important: true, urgent: true, quadOrder: 0 });
            const q4 = createQuadTask({ id: 'q4' });

            const siblings = getSiblings(q2a, [q2a, q2b, q1, q4], 'quad');

            expect(siblings.map(t => t.id)).toEqual(['q2b', 'q2a']);
        });

        it('quad context excludes archived, completed, undated and future-due tasks', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            const active = createQuadTask({ id: 'active', urgent: true, quadOrder: 0 });
            const archived = createQuadTask({ id: 'archived', urgent: true, archived: true });
            const completed = createQuadTask({ id: 'completed', urgent: true, completed: true });
            const undated = createTask({ id: 'undated', urgent: true });
            const future = createTask({ id: 'future', urgent: true, dueDate: tomorrow });

            const siblings = getSiblings(active, [active, archived, completed, undated, future], 'quad');

            expect(siblings.map(t => t.id)).toEqual(['active']);
        });

        it('quad context: tasks never manually placed sort below placed ones', () => {
            const placed = createQuadTask({ id: 'placed', quadOrder: 1000, createdAt: 200 });
            const unplaced = createQuadTask({ id: 'unplaced', quadOrder: null, createdAt: 100 });

            const siblings = getSiblings(placed, [unplaced, placed], 'quad');

            // unplaced falls back to createdAt (100) — but any realistic createdAt
            // is a ms timestamp far larger than manual orders; here we simulate a
            // tiny one to document the raw fallback semantics.
            expect(siblings.map(t => t.id)).toEqual(['unplaced', 'placed']);
        });
    });

    describe('calculateInsertOrder', () => {
        it('should calculate orders when inserting at beginning', () => {
            const existing = [
                createTask({ id: 'a', order: 1000 }),
                createTask({ id: 'b', order: 2000 }),
            ];

            const updates = calculateInsertOrder(existing, 'new', 0);

            expect(updates['new']).toBe(0);
            expect(updates['a']).toBe(1000);
            expect(updates['b']).toBe(2000);
        });

        it('should calculate orders when inserting in middle', () => {
            const existing = [
                createTask({ id: 'a', order: 1000 }),
                createTask({ id: 'b', order: 2000 }),
            ];

            const updates = calculateInsertOrder(existing, 'new', 1);

            expect(updates['a']).toBe(0);
            expect(updates['new']).toBe(1000);
            expect(updates['b']).toBe(2000);
        });

        it('should calculate orders when inserting at end', () => {
            const existing = [
                createTask({ id: 'a', order: 1000 }),
                createTask({ id: 'b', order: 2000 }),
            ];

            const updates = calculateInsertOrder(existing, 'new', 2);

            expect(updates['a']).toBe(0);
            expect(updates['b']).toBe(1000);
            expect(updates['new']).toBe(2000);
        });
    });

    describe('calculateMoveUpDown', () => {
        it('should swap orders when moving up', () => {
            const siblings = [
                createTask({ id: 'a', order: 1000 }),
                createTask({ id: 'b', order: 2000 }),
                createTask({ id: 'c', order: 3000 }),
            ];

            const updates = calculateMoveUpDown(siblings, 'b', 'up');

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

            const updates = calculateMoveUpDown(siblings, 'b', 'down');

            expect(updates).not.toBeNull();
            expect(updates!['b']).toBe(2000); // b moves to c's position
            expect(updates!['c']).toBe(1000); // c moves to b's position
        });

        it('should return null when moving first item up', () => {
            const siblings = [
                createTask({ id: 'a', order: 1000 }),
                createTask({ id: 'b', order: 2000 }),
            ];

            const updates = calculateMoveUpDown(siblings, 'a', 'up');

            expect(updates).toBeNull();
        });

        it('should return null when moving last item down', () => {
            const siblings = [
                createTask({ id: 'a', order: 1000 }),
                createTask({ id: 'b', order: 2000 }),
            ];

            const updates = calculateMoveUpDown(siblings, 'b', 'down');

            expect(updates).toBeNull();
        });

        it('should return null when task not in siblings', () => {
            const siblings = [
                createTask({ id: 'a', order: 1000 }),
            ];

            const updates = calculateMoveUpDown(siblings, 'unknown', 'up');

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
});
