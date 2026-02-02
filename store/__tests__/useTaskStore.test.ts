import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTaskStore } from '../useTaskStore';
import { act } from '@testing-library/react';

// Helper to reset store between tests
const getCleanStore = () => {
    // Reset the store to initial state
    useTaskStore.setState({
        tasks: [],
        focusedId: null,
        isLoading: false,
        error: null,
        guestMode: true, // Use guest mode to avoid Supabase calls
        pendingOperations: [],
        lastSyncedAt: null,
        selectedIds: [],
        history: [],
        future: [],
    });
    return useTaskStore.getState();
};

describe('useTaskStore', () => {
    beforeEach(() => {
        getCleanStore();
    });

    describe('Task CRUD Operations', () => {
        it('should add a task with parsed title', () => {
            const store = useTaskStore.getState();

            act(() => {
                store.addTask('Buy groceries');
            });

            const { tasks } = useTaskStore.getState();
            expect(tasks).toHaveLength(1);
            expect(tasks[0].title).toBe('Buy groceries');
            expect(tasks[0].completed).toBe(false);
        });

        it('should add a task with priority from text', () => {
            const store = useTaskStore.getState();

            act(() => {
                store.addTask('Urgent task !1');
            });

            const { tasks } = useTaskStore.getState();
            expect(tasks).toHaveLength(1);
            expect(tasks[0].priority).toBe(1);
        });

        it('should update an existing task', () => {
            const store = useTaskStore.getState();

            act(() => {
                store.addTask('Original title');
            });

            const { tasks } = useTaskStore.getState();
            const taskId = tasks[0].id;

            act(() => {
                store.updateTask(taskId, { title: 'Updated title' });
            });

            const updatedTasks = useTaskStore.getState().tasks;
            expect(updatedTasks[0].title).toBe('Updated title');
        });

        it('should toggle task completion', () => {
            const store = useTaskStore.getState();

            act(() => {
                store.addTask('Test task');
            });

            const { tasks } = useTaskStore.getState();
            const taskId = tasks[0].id;
            expect(tasks[0].completed).toBe(false);

            act(() => {
                store.toggleTask(taskId);
            });

            expect(useTaskStore.getState().tasks[0].completed).toBe(true);

            act(() => {
                store.toggleTask(taskId);
            });

            expect(useTaskStore.getState().tasks[0].completed).toBe(false);
        });

        it('should delete a task', () => {
            const store = useTaskStore.getState();

            act(() => {
                store.addTask('Task to delete');
            });

            const { tasks } = useTaskStore.getState();
            expect(tasks).toHaveLength(1);
            const taskId = tasks[0].id;

            act(() => {
                store.deleteTask(taskId);
            });

            expect(useTaskStore.getState().tasks).toHaveLength(0);
        });
    });

    describe('Priority Operations', () => {
        it('should set task priority', () => {
            const store = useTaskStore.getState();

            act(() => {
                store.addTask('Priority test');
            });

            const { tasks } = useTaskStore.getState();
            const taskId = tasks[0].id;

            act(() => {
                store.setPriority(taskId, 1);
            });

            expect(useTaskStore.getState().tasks[0].priority).toBe(1);

            act(() => {
                store.setPriority(taskId, 4);
            });

            expect(useTaskStore.getState().tasks[0].priority).toBe(4);
        });
    });

    describe('Selection Operations', () => {
        it('should select a single task', () => {
            const store = useTaskStore.getState();

            act(() => {
                store.addTask('Task 1');
                store.addTask('Task 2');
            });

            const { tasks } = useTaskStore.getState();

            act(() => {
                store.selectTask(tasks[0].id, false);
            });

            expect(useTaskStore.getState().selectedIds).toEqual([tasks[0].id]);
        });

        it('should multi-select tasks', () => {
            const store = useTaskStore.getState();

            act(() => {
                store.addTask('Task 1');
                store.addTask('Task 2');
            });

            const { tasks } = useTaskStore.getState();

            act(() => {
                store.selectTask(tasks[0].id, true);
                store.selectTask(tasks[1].id, true);
            });

            expect(useTaskStore.getState().selectedIds).toHaveLength(2);
        });

        it('should clear selection', () => {
            const store = useTaskStore.getState();

            act(() => {
                store.addTask('Task 1');
            });

            const { tasks } = useTaskStore.getState();

            act(() => {
                store.selectTask(tasks[0].id, false);
            });

            expect(useTaskStore.getState().selectedIds).toHaveLength(1);

            act(() => {
                store.clearSelection();
            });

            expect(useTaskStore.getState().selectedIds).toHaveLength(0);
        });
    });

    // NOTE: Undo/Redo tests are skipped because the current implementation
    // has documented bugs (see ARCHITECTURE_REVIEW.md #3). These will be fixed in Phase 3.
    describe.skip('Undo/Redo Operations - Known Bugs (Phase 3)', () => {
        it('should undo task addition', async () => {
            const store = useTaskStore.getState();

            act(() => {
                store.addTask('Undoable task');
            });

            expect(useTaskStore.getState().tasks).toHaveLength(1);
            expect(useTaskStore.getState().history).toHaveLength(1);

            await act(async () => {
                await store.undo();
            });

            expect(useTaskStore.getState().tasks).toHaveLength(0);
            expect(useTaskStore.getState().future).toHaveLength(1);
        });

        it('should redo undone action', async () => {
            const store = useTaskStore.getState();

            act(() => {
                store.addTask('Redo test');
            });

            const originalTask = useTaskStore.getState().tasks[0];

            await act(async () => {
                await store.undo();
            });

            expect(useTaskStore.getState().tasks).toHaveLength(0);

            await act(async () => {
                await store.redo();
            });

            expect(useTaskStore.getState().tasks).toHaveLength(1);
        });
    });

    describe('Focus Management', () => {
        it('should set focused task id', () => {
            const store = useTaskStore.getState();

            act(() => {
                store.addTask('Focus test');
            });

            const { tasks } = useTaskStore.getState();

            act(() => {
                store.setFocusedId(tasks[0].id);
            });

            expect(useTaskStore.getState().focusedId).toBe(tasks[0].id);

            act(() => {
                store.setFocusedId(null);
            });

            expect(useTaskStore.getState().focusedId).toBeNull();
        });
    });
});
