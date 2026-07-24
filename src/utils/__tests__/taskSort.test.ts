import { describe, it, expect } from 'vitest';
import {
    buildTaskMap,
    getSortPath,
    compareHierarchy,
    buildChildrenMap,
    flattenTree,
    startOfDay,
    endOfDay,
    getUpcomingBucketName,
    filterActive,
    filterTodayQuad,
    filterUpcoming,
    createSectionHeader,
    getCreationDefaults,
} from '../taskSort';
import { quadrantOf, quadrantFlags, sortQuadrant, topOfQuadrant } from '../quad';
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

describe('taskSort utilities', () => {
    describe('buildTaskMap', () => {
        it('should create a map from task array', () => {
            const task1 = createTask({ id: 'task-1' });
            const task2 = createTask({ id: 'task-2' });
            const map = buildTaskMap([task1, task2]);

            expect(map.size).toBe(2);
            expect(map.get('task-1')).toBe(task1);
            expect(map.get('task-2')).toBe(task2);
        });
    });

    describe('getSortPath', () => {
        it('should return path for root task', () => {
            const task = createTask({ id: 'root', order: 100 });
            const taskMap = buildTaskMap([task]);

            const path = getSortPath(task, taskMap);
            expect(path).toEqual([100]);
        });

        it('should return path for nested task', () => {
            const parent = createTask({ id: 'parent', order: 100 });
            const child = createTask({ id: 'child', order: 200, parentId: 'parent' });
            const taskMap = buildTaskMap([parent, child]);

            const path = getSortPath(child, taskMap);
            expect(path).toEqual([100, 200]);
        });
    });

    describe('compareHierarchy', () => {
        it('should sort by order at same level', () => {
            const task1 = createTask({ id: '1', order: 100 });
            const task2 = createTask({ id: '2', order: 200 });
            const taskMap = buildTaskMap([task1, task2]);

            expect(compareHierarchy(task1, task2, taskMap)).toBeLessThan(0);
            expect(compareHierarchy(task2, task1, taskMap)).toBeGreaterThan(0);
        });

        it('should keep children after parents', () => {
            const parent = createTask({ id: 'parent', order: 100 });
            const child = createTask({ id: 'child', order: 50, parentId: 'parent' });
            const taskMap = buildTaskMap([parent, child]);

            expect(compareHierarchy(parent, child, taskMap)).toBeLessThan(0);
        });
    });

    describe('buildChildrenMap', () => {
        it('should group children by parent', () => {
            const parent = createTask({ id: 'parent', order: 1 });
            const child1 = createTask({ id: 'child1', order: 1, parentId: 'parent' });
            const child2 = createTask({ id: 'child2', order: 2, parentId: 'parent' });

            const map = buildChildrenMap([parent, child1, child2]);

            expect(map.get('root')?.length).toBe(1);
            expect(map.get('parent')?.length).toBe(2);
        });
    });

    describe('flattenTree', () => {
        it('should flatten expanded tree with depths', () => {
            const parent = createTask({ id: 'parent', order: 1, expanded: true });
            const child = createTask({ id: 'child', order: 1, parentId: 'parent' });

            const childrenMap = buildChildrenMap([parent, child]);
            const result = flattenTree(childrenMap);

            expect(result).toHaveLength(2);
            expect(result[0].depth).toBe(0);
            expect(result[1].depth).toBe(1);
        });

        it('should not include children when collapsed', () => {
            const parent = createTask({ id: 'parent', order: 1, expanded: false });
            const child = createTask({ id: 'child', order: 1, parentId: 'parent' });

            const childrenMap = buildChildrenMap([parent, child]);
            const result = flattenTree(childrenMap);

            expect(result).toHaveLength(1);
            expect(result[0].hasChildren).toBe(true);
        });
    });

    describe('date utilities', () => {
        it('startOfDay should return midnight', () => {
            const date = new Date('2026-02-02T14:30:00');
            const start = startOfDay(date);

            expect(start.getHours()).toBe(0);
            expect(start.getMinutes()).toBe(0);
            expect(start.getDate()).toBe(2);
        });

        it('endOfDay should return next day midnight', () => {
            const date = new Date('2026-02-02T14:30:00');
            const end = endOfDay(date);

            expect(end.getDate()).toBe(3);
            expect(end.getHours()).toBe(0);
        });

        it('getUpcomingBucketName should return "Tomorrow" for next day', () => {
            const today = new Date('2026-02-02');
            const tomorrow = new Date('2026-02-03');

            expect(getUpcomingBucketName(tomorrow, today)).toBe('Tomorrow');
        });

        it('getUpcomingBucketName should return weekday for this week', () => {
            const today = new Date('2026-02-02'); // Monday
            const wednesday = new Date('2026-02-04');

            expect(getUpcomingBucketName(wednesday, today)).toBe('Wednesday');
        });

        it('getUpcomingBucketName should return month for later dates', () => {
            const today = new Date('2026-02-02');
            const future = new Date('2026-03-15');

            expect(getUpcomingBucketName(future, today)).toBe('March 2026');
        });
    });

    describe('filterActive', () => {
        it('should exclude archived and completed tasks', () => {
            const active = createTask({ title: 'Active' });
            const completed = createTask({ title: 'Done', completed: true });
            const archived = createTask({ title: 'Archived', archived: true });

            const result = filterActive([active, completed, archived]);

            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('Active');
        });
    });

    describe('filterTodayQuad', () => {
        it('splits due-today tasks into the four quadrants by flags', () => {
            const today = new Date('2026-02-02');
            const q1 = createTask({ title: 'Q1', dueDate: today, urgent: true, important: true });
            const q2 = createTask({ title: 'Q2', dueDate: today, important: true });
            const q3 = createTask({ title: 'Q3', dueDate: today, urgent: true });
            const q4 = createTask({ title: 'Q4', dueDate: today });

            const result = filterTodayQuad([q1, q2, q3, q4], today);

            expect(result.q1.map(t => t.title)).toEqual(['Q1']);
            expect(result.q2.map(t => t.title)).toEqual(['Q2']);
            expect(result.q3.map(t => t.title)).toEqual(['Q3']);
            expect(result.q4.map(t => t.title)).toEqual(['Q4']);
        });

        it('should include overdue tasks', () => {
            const today = new Date('2026-02-02');
            const overdue = createTask({
                title: 'Overdue',
                dueDate: new Date('2026-02-01')
            });

            const result = filterTodayQuad([overdue], today);

            expect(result.q4).toHaveLength(1);
        });

        it('excludes completed, archived, undated and future-due tasks', () => {
            const today = new Date('2026-02-02');
            const done = createTask({ dueDate: today, completed: true });
            const archived = createTask({ dueDate: today, archived: true });
            const undated = createTask({});
            const future = createTask({ dueDate: new Date('2026-02-05') });

            const result = filterTodayQuad([done, archived, undated, future], today);

            expect(result.q1.length + result.q2.length + result.q3.length + result.q4.length).toBe(0);
        });

        it('sorts each quadrant by quadOrder', () => {
            const today = new Date('2026-02-02');
            const second = createTask({ title: 'Second', dueDate: today, important: true, quadOrder: 2000 });
            const first = createTask({ title: 'First', dueDate: today, important: true, quadOrder: 1000 });

            const result = filterTodayQuad([second, first], today);

            expect(result.q2.map(t => t.title)).toEqual(['First', 'Second']);
        });
    });

    describe('filterUpcoming', () => {
        it('should only include future tasks', () => {
            const today = new Date('2026-02-02');
            const tomorrow = createTask({
                title: 'Tomorrow',
                dueDate: new Date('2026-02-03')
            });
            const past = createTask({
                title: 'Past',
                dueDate: new Date('2026-02-01')
            });

            const result = filterUpcoming([tomorrow, past], today);

            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('Tomorrow');
        });
    });

    describe('quad utilities', () => {
        it('quadrantOf derives the quadrant from the two flags', () => {
            expect(quadrantOf({ urgent: true, important: true })).toBe('q1');
            expect(quadrantOf({ urgent: false, important: true })).toBe('q2');
            expect(quadrantOf({ urgent: true, important: false })).toBe('q3');
            expect(quadrantOf({})).toBe('q4');
        });

        it('quadrantFlags is the inverse of quadrantOf', () => {
            (['q1', 'q2', 'q3', 'q4'] as const).forEach(k => {
                expect(quadrantOf(quadrantFlags(k))).toBe(k);
            });
        });

        it('sortQuadrant orders by quadOrder, unplaced (createdAt fallback) last', () => {
            const placed2 = createTask({ title: 'placed2', quadOrder: 2000 });
            const placed1 = createTask({ title: 'placed1', quadOrder: 1000 });
            const unplaced = createTask({ title: 'unplaced', quadOrder: null }); // createdAt ≈ now, huge

            const result = sortQuadrant([unplaced, placed2, placed1]);

            expect(result.map(t => t.title)).toEqual(['placed1', 'placed2', 'unplaced']);
        });

        it('topOfQuadrant lands above every current member', () => {
            const members = [
                createTask({ quadOrder: 1000 }),
                createTask({ quadOrder: 5000 }),
            ];
            expect(topOfQuadrant(members)).toBe(0);
            expect(topOfQuadrant([])).toBe(0);
        });
    });

    describe('createSectionHeader', () => {
        it('should create a header with correct properties', () => {
            const header = createSectionHeader('header-1', 'Test Section', 5);

            expect(header.isHeader).toBe(true);
            expect(header.title).toBe('Test Section');
            expect(header.count).toBe(5);
            expect(header.depth).toBe(0);
        });
    });

    describe('getCreationDefaults', () => {
        const ref = new Date(2026, 5, 19, 15, 0, 0); // Fri 19 Jun 2026, 3pm

        it('defaults to today (midnight) in the Today view', () => {
            const { dueDate, important, urgent } = getCreationDefaults('today', null, ref);
            expect(dueDate).toEqual(startOfDay(ref));
            expect(important).toBe(false);
            expect(urgent).toBe(false);
        });

        it('inherits the Eisenhower flags from the focused row in Today', () => {
            const { dueDate, important, urgent } = getCreationDefaults('today', { urgent: true, important: true }, ref);
            expect(dueDate).toEqual(startOfDay(ref));
            expect(important).toBe(true);
            expect(urgent).toBe(true);
        });

        it('inherits the focused day in the Upcoming view', () => {
            const day = new Date(2026, 5, 22, 9, 0, 0);
            const { dueDate } = getCreationDefaults('upcoming', { dueDate: day }, ref);
            expect(dueDate).toEqual(day);
        });

        it('gives no due date in Upcoming when nothing is focused', () => {
            const { dueDate } = getCreationDefaults('upcoming', null, ref);
            expect(dueDate).toBeNull();
        });

        it('never sets a due date in the Inbox (active) view', () => {
            const day = new Date(2026, 5, 22);
            const { dueDate, important } = getCreationDefaults('active', { dueDate: day, important: true }, ref);
            expect(dueDate).toBeNull();
            expect(important).toBe(true); // flags still inherit
        });
    });
});
