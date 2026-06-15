import { useEffect, MutableRefObject } from 'react';
import { useTaskStore } from '../../store/useTaskStore';
import { useUIStore } from '../../store/useUIStore';
import { toast } from '../Toaster';
import { VisibleTask } from './types';
// Hotkeys are centrally defined in utils/hotkeys.ts
// This handler implements the actual key bindings - keep in sync with registry

interface UseTaskListKeyboardProps {
    visibleTasksRef: MutableRefObject<VisibleTask[]>;
    focusedIdRef: MutableRefObject<string | null>;
    selectedIdsRef: MutableRefObject<string[]>;
    editingTaskIdRef: MutableRefObject<string | null>;
    filter: string;
    expandedGroups: Set<string>;
    toggleGroup: (id: string) => void;
    requestComplete?: (id: string) => void;
}

export function useTaskListKeyboard({
    visibleTasksRef,
    focusedIdRef,
    selectedIdsRef,
    editingTaskIdRef,
    filter,
    expandedGroups,
    toggleGroup,
    requestComplete,
}: UseTaskListKeyboardProps) {
    const {
        setFocusedId,
        toggleTask,
        archiveTask,
        toggleExpand,
        setExpandedAll,
        changeParent,
        batchChangeParent,
        batchComplete,
        batchMove,
        toggleImportance,
        clearImportance,
        selectTask,
        clearSelection,
        pushTodayToTomorrow,
        tasks
    } = useTaskStore();

    const {
        focusMode,
        setFocusMode,
        setQuickAddOpen,
        setEditingTaskId,
    } = useUIStore();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (focusMode !== 'main') return;
            if (editingTaskIdRef.current) return;
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

            const currentTasks = visibleTasksRef.current;
            const currentId = focusedIdRef.current;
            const currentSelectedIds = selectedIdsRef.current;

            const currentIndex = currentTasks.findIndex(t => t.id === currentId);
            const currentTask = currentTasks[currentIndex];

            const navigate = (newIndex: number) => {
                const safeIndex = (newIndex + currentTasks.length) % currentTasks.length;
                const taskId = currentTasks[safeIndex].id;
                setFocusedId(taskId);

                setTimeout(() => {
                    const element = document.querySelector(`[data-task-id="${taskId}"]`);
                    element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 0);
            };

            const key = e.key.toLowerCase();
            const isShift = e.shiftKey;
            const isCmd = e.metaKey || e.ctrlKey; // Cmd on macOS — used for Move Task
            const isAlt = e.altKey; // Option — still drives Expand/Collapse All (⌥⇧→/←)

            // Push all outstanding tasks due today-or-earlier to tomorrow.
            // Works from any task view, not just Today.
            if (key === 't' && isShift && !isCmd && !isAlt) {
                e.preventDefault();
                const count = pushTodayToTomorrow();
                if (count > 0) {
                    toast(`Moved ${count} task${count === 1 ? '' : 's'} to tomorrow`, {
                        label: 'Undo',
                        onClick: () => useTaskStore.getState().undo(),
                    });
                }
                return;
            }

            // Conflict Resolution: "Expand All" moved to Alt+Shift
            if (e.altKey && isShift && (key === 'l' || key === 'arrowright')) {
                e.preventDefault();
                setExpandedAll(true);
                return;
            }
            if (e.altKey && isShift && (key === 'h' || key === 'arrowleft')) {
                e.preventDefault();
                setExpandedAll(false);
                return;
            }

            switch (key) {
                case 'arrowdown': {
                    e.preventDefault();
                    if (currentIndex === -1 && currentTasks.length > 0) {
                        navigate(0);
                        return;
                    }

                    if (isCmd && currentTask) {
                        // Skip reordering in Upcoming view — order is determined by date
                        if (filter === 'upcoming') return;

                        const isToday = filter === 'today';
                        const context = isToday ? 'today' : 'project';
                        // Move the whole selection together when multiple are selected.
                        if (currentSelectedIds.length > 1) {
                            batchMove('down', { context });
                        } else {
                            useTaskStore.getState().moveTask(currentTask.id, 'down', { context });
                        }
                        return;
                    }



                    if (isShift && currentTask) {
                        selectTask(currentTask.id, true);
                        const nextIndex = (currentIndex + 1) % currentTasks.length;
                        const nextTask = currentTasks[nextIndex];
                        navigate(nextIndex);
                        selectTask(nextTask.id, true);
                        return;
                    }

                    clearSelection();
                    navigate(currentIndex + 1);
                    break;
                }
                case 'arrowup': {
                    e.preventDefault();
                    if (currentIndex === -1 && currentTasks.length > 0) {
                        navigate(currentTasks.length - 1);
                        return;
                    }

                    if (isCmd && currentTask) {
                        // Skip reordering in Upcoming view — order is determined by date
                        if (filter === 'upcoming') return;

                        const isToday = filter === 'today';
                        const context = isToday ? 'today' : 'project';
                        // Move the whole selection together when multiple are selected.
                        if (currentSelectedIds.length > 1) {
                            batchMove('up', { context });
                        } else {
                            useTaskStore.getState().moveTask(currentTask.id, 'up', { context });
                        }
                        return;
                    }



                    if (isShift && currentTask) {
                        selectTask(currentTask.id, true);
                        const prevIndex = (currentIndex - 1 + currentTasks.length) % currentTasks.length;
                        const prevTask = currentTasks[prevIndex];
                        navigate(prevIndex);
                        selectTask(prevTask.id, true);
                        return;
                    }

                    clearSelection();
                    navigate(currentIndex - 1);
                    break;
                }
                case 'arrowright':
                    e.preventDefault();
                    if (currentTask) {
                        if (currentTask.isHeader && toggleGroup) {
                            if (!expandedGroups.has(currentTask.id)) {
                                toggleGroup(currentTask.id);
                            }
                        } else if (currentTask.hasChildren) {
                            if (!currentTask.expanded) {
                                toggleExpand(currentTask.id);
                            }
                        }
                    }
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    if (currentTask) {
                        if (currentTask.isHeader && toggleGroup) {
                            if (expandedGroups.has(currentTask.id)) {
                                toggleGroup(currentTask.id);
                            }
                        } else if (currentTask.hasChildren && currentTask.expanded) {
                            toggleExpand(currentTask.id);
                        }
                    }
                    break;
                case 'enter':
                    if (currentTask && currentTask.isHeader && toggleGroup) {
                        e.preventDefault();
                        toggleGroup(currentTask.id);
                        return;
                    }
                    if (isCmd) { if (currentId) setQuickAddOpen(true, currentId); }
                    else { if (currentId) setQuickAddOpen(true, currentTask.parentId || null, 'create', currentId); else setQuickAddOpen(true); }
                    break;
                case 'tab':
                    e.preventDefault();
                    if (currentSelectedIds.length > 1) {
                        const tasksToIndent = currentTasks.filter(t => currentSelectedIds.includes(t.id));
                        tasksToIndent.sort((a, b) => currentTasks.indexOf(a) - currentTasks.indexOf(b));

                        if (isShift) { // Outdent
                            const updates: { id: string, newParentId: string | null }[] = [];
                            tasksToIndent.forEach(t => {
                                if (t.parentId) {
                                    const parent = tasks.find(pt => pt.id === t.parentId);
                                    updates.push({ id: t.id, newParentId: parent?.parentId || null });
                                }
                            });
                            batchChangeParent(updates);
                        } else { // Indent
                            const updates: { id: string, newParentId: string | null }[] = [];
                            tasksToIndent.forEach(t => {
                                const idx = currentTasks.findIndex(ct => ct.id === t.id);
                                if (idx > 0) {
                                    const prev = currentTasks[idx - 1];
                                    if (prev.depth === t.depth || prev.depth > t.depth) {
                                        updates.push({ id: t.id, newParentId: prev.id });
                                        if (!prev.expanded) toggleExpand(prev.id);
                                    }
                                }
                            });
                            batchChangeParent(updates);
                        }
                        return;
                    }
                    // Single Task Logic
                    if (!currentId) return;
                    if (isShift) {
                        if (currentTask.parentId) {
                            const parent = tasks.find(t => t.id === currentTask.parentId);
                            changeParent(currentId, parent?.parentId || null);
                        }
                    }
                    else {
                        if (currentIndex > 0) {
                            const prevTask = currentTasks[currentIndex - 1];
                            if (prevTask.depth === currentTask.depth || prevTask.depth > currentTask.depth) {
                                changeParent(currentId, prevTask.id);
                                if (!prevTask.expanded) toggleExpand(prevTask.id);
                            }
                        }
                    }
                    break;
                case 'x':
                    if (currentSelectedIds.length > 1) { batchComplete(); }
                    else if (currentId) { (requestComplete ?? toggleTask)(currentId); }
                    break;
                case 'delete':
                case 'backspace':
                    if (currentSelectedIds.length > 1) {
                        e.preventDefault();
                        // Archive all selected tasks (soft-delete)
                        currentSelectedIds.forEach(id => archiveTask(id));
                        clearSelection();
                    }
                    else if (currentId && !editingTaskIdRef.current) { e.preventDefault(); archiveTask(currentId); }
                    break;
                case 'e':
                    if (currentId && !editingTaskIdRef.current) {
                        e.preventDefault();
                        setEditingTaskId(currentId);
                    }
                    break;
                case 'd': if (currentId) { e.preventDefault(); setQuickAddOpen(true, null, 'date', currentId); } break;
                case 'o':
                    if (isCmd && currentId) { e.preventDefault(); const text = (currentTask.title + " " + (currentTask.notes || "")); const match = text.match(/(https?:\/\/[^\s]+)/g); if (match && match[0]) window.open(match[0], '_blank'); }
                    break;
                case '1':
                    if (currentId && !editingTaskIdRef.current) {
                        e.preventDefault();
                        toggleImportance(currentId);
                    }
                    break;
                case '0':
                    if (currentId && !editingTaskIdRef.current) {
                        e.preventDefault();
                        clearImportance(currentId);
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        focusMode, filter, expandedGroups, tasks,
        setFocusedId, toggleTask, archiveTask, toggleExpand, setExpandedAll,
        changeParent, batchChangeParent, batchComplete, batchMove,
        toggleImportance, clearImportance, setFocusMode, setQuickAddOpen,
        selectTask, clearSelection, setEditingTaskId,
        pushTodayToTomorrow, requestComplete
    ]);
}
