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
    filterToday,
    filterUpcoming,
    sortImportant,
    sortOutstandingForToday,
    sortUpcoming,
    groupByBucket,
    createSectionHeader,
} from '../taskSort';
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

    describe('filterToday', () => {
        it('should separate important and outstanding tasks', () => {
            const today = new Date('2026-02-02');
            const important = createTask({
                title: 'Important',
                dueDate: today,
                importantOrder: 1
            });
            const outstanding = createTask({
                title: 'Outstanding',
                dueDate: today
            });

            const result = filterToday([important, outstanding], today);

            expect(result.important).toHaveLength(1);
            expect(result.outstanding).toHaveLength(1);
        });

        it('should include overdue tasks', () => {
            const today = new Date('2026-02-02');
            const overdue = createTask({
                title: 'Overdue',
                dueDate: new Date('2026-02-01')
            });

            const result = filterToday([overdue], today);

            expect(result.outstanding).toHaveLength(1);
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

    describe('sortImportant', () => {
        it('should sort by importantOrder', () => {
            const task1 = createTask({ title: 'Second', importantOrder: 2 });
            const task2 = createTask({ title: 'First', importantOrder: 1 });

            const result = sortImportant([task1, task2]);

            expect(result[0].title).toBe('First');
            expect(result[1].title).toBe('Second');
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
});
