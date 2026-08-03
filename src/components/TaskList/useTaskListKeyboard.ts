import { useEffect, MutableRefObject } from 'react';
import { useTaskStore } from '../../store/useTaskStore';
import { useUIStore } from '../../store/useUIStore';
import { toast } from '../Toaster';
import { VisibleTask } from './types';
import { getCreationDefaults, ViewFilter } from '../../utils/taskSort';
import { QUADRANTS, quadrantFlags } from '../../utils/quad';
import { quadNavTarget, quadStops } from '../../utils/quadNav';
import { isGChordPending, isKeyConsumed } from '../../utils/keyChord';
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
        toggleUrgent,
        toggleImportant,
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
            // A pending/resolving g-chord ("g then i" → go to Inbox) owns the next
            // keypress — without this, the chord's second key would also fire the
            // single-letter actions below (i = toggle Important, u = Urgent).
            if (isKeyConsumed(e) || isGChordPending()) return;

            const currentTasks = visibleTasksRef.current;
            const currentId = focusedIdRef.current;
            const currentSelectedIds = selectedIdsRef.current;

            const currentIndex = currentTasks.findIndex(t => t.id === currentId);
            const currentTask = currentTasks[currentIndex];

            const navigate = (newIndex: number) => {
                // Guard against an empty list: `x % 0` is NaN, and indexing with it
                // throws when we read `.id` — which surfaced as the full-screen
                // ErrorBoundary. Nothing to focus when there are no tasks.
                if (currentTasks.length === 0) return;
                const safeIndex = (newIndex + currentTasks.length) % currentTasks.length;
                const taskId = currentTasks[safeIndex].id;
                setFocusedId(taskId);

                setTimeout(() => {
                    const element = document.querySelector(`[data-task-id="${taskId}"]`);
                    element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 0);
            };

            // Today is the 2×2 Eisenhower board, not a list — arrows move around
            // the grid instead of down the flat list. See utils/quadNav.
            const isBoard = filter === 'today';

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

                        // In Today, ⌘↓ moves within the current quadrant (stops at
                        // its edge — flags are the only way to cross quadrants).
                        const context = filter === 'today' ? 'quad' : 'project';
                        // Move the whole selection together when multiple are selected.
                        if (currentSelectedIds.length > 1) {
                            batchMove('down', { context });
                        } else {
                            useTaskStore.getState().moveTask(currentTask.id, 'down', { context });
                        }
                        return;
                    }



                    // On the board ↓ walks the focused quadrant, then steps into
                    // the one below it (Q1→Q3, Q2→Q4) and stops at the bottom.
                    const nextIndex = isBoard
                        ? quadNavTarget(currentTasks, currentId, 'down')
                        : (currentIndex + 1) % currentTasks.length;
                    if (nextIndex === null) return;

                    if (isShift && currentTask) {
                        selectTask(currentTask.id, true);
                        navigate(nextIndex);
                        selectTask(currentTasks[nextIndex].id, true);
                        return;
                    }

                    clearSelection();
                    navigate(nextIndex);
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

                        const context = filter === 'today' ? 'quad' : 'project';
                        // Move the whole selection together when multiple are selected.
                        if (currentSelectedIds.length > 1) {
                            batchMove('up', { context });
                        } else {
                            useTaskStore.getState().moveTask(currentTask.id, 'up', { context });
                        }
                        return;
                    }



                    const prevIndex = isBoard
                        ? quadNavTarget(currentTasks, currentId, 'up')
                        : (currentIndex - 1 + currentTasks.length) % currentTasks.length;
                    if (prevIndex === null) return;

                    if (isShift && currentTask) {
                        selectTask(currentTask.id, true);
                        navigate(prevIndex);
                        selectTask(currentTasks[prevIndex].id, true);
                        return;
                    }

                    clearSelection();
                    navigate(prevIndex);
                    break;
                }
                case 'arrowright':
                case 'arrowleft': {
                    e.preventDefault();
                    const direction = key === 'arrowright' ? 'right' : 'left';

                    // The board's rows are flat (no subtasks, no collapsible
                    // quadrants), so ←/→ are free to cross columns instead.
                    if (isBoard) {
                        const target = quadNavTarget(currentTasks, currentId, direction);
                        if (target === null) return;
                        clearSelection();
                        navigate(target);
                        return;
                    }

                    const expanding = direction === 'right';
                    if (currentTask) {
                        if (currentTask.isHeader && toggleGroup) {
                            if (expandedGroups.has(currentTask.id) !== expanding) {
                                toggleGroup(currentTask.id);
                            }
                        } else if (currentTask.hasChildren && !!currentTask.expanded !== expanding) {
                            toggleExpand(currentTask.id);
                        }
                    }
                    break;
                }
                case 'enter': {
                    const viewFilter = filter as ViewFilter;
                    if (currentTask && currentTask.isHeader) {
                        // In Upcoming, a day-group header stands for a concrete day —
                        // Enter adds a task due that day. (Arrows / click still toggle.)
                        if (viewFilter === 'upcoming' && currentTask.bucketDate) {
                            e.preventDefault();
                            const defaults = getCreationDefaults(viewFilter, { dueDate: currentTask.bucketDate });
                            setQuickAddOpen(true, null, 'create', null, defaults);
                            return;
                        }
                        // In Today, a quadrant header stands for its flags — Enter
                        // adds a task due today, landing in that quadrant.
                        const quad = QUADRANTS.find(q => q.headerId === currentTask.id);
                        if (viewFilter === 'today' && quad) {
                            e.preventDefault();
                            const defaults = getCreationDefaults(viewFilter, quadrantFlags(quad.key));
                            setQuickAddOpen(true, null, 'create', null, defaults);
                            return;
                        }
                        if (toggleGroup) {
                            e.preventDefault();
                            toggleGroup(currentTask.id);
                            return;
                        }
                    }
                    if (isCmd) {
                        // Subtask under the focused row — inherits its day/importance
                        // the same way a sibling would.
                        if (currentId) setQuickAddOpen(true, currentId, 'create', null, getCreationDefaults(viewFilter, currentTask));
                    }
                    else if (currentId) {
                        // New task inherits the focused row's day / importance.
                        const defaults = getCreationDefaults(viewFilter, currentTask);
                        setQuickAddOpen(true, currentTask.parentId || null, 'create', currentId, defaults);
                    } else {
                        // Empty / nothing focused (e.g. an empty Today list) — still
                        // inherit the view's default (today in Today).
                        setQuickAddOpen(true, null, 'create', null, getCreationDefaults(viewFilter, null));
                    }
                    break;
                }
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
                // Eisenhower flags — work in every task view, not just Today.
                // Toggling moves the task to the top of its new quadrant; focus
                // stays on the task (it's tracked by id), so it follows the move.
                case 'u':
                    if (!isCmd && !isAlt && currentId && !currentTask?.isHeader) {
                        e.preventDefault();
                        if (currentSelectedIds.length > 1) currentSelectedIds.forEach(id => toggleUrgent(id));
                        else toggleUrgent(currentId);
                    }
                    break;
                case 'i':
                    if (!isCmd && !isAlt && currentId && !currentTask?.isHeader) {
                        e.preventDefault();
                        if (currentSelectedIds.length > 1) currentSelectedIds.forEach(id => toggleImportant(id));
                        else toggleImportant(currentId);
                    }
                    break;
                // 1–4: jump focus to a quadrant in the Today board (its first
                // task, or the header itself when it's empty).
                case '1': case '2': case '3': case '4': {
                    if (!isBoard || isCmd || isAlt) break;
                    e.preventDefault();
                    const stops = quadStops(currentTasks)[parseInt(key, 10) - 1];
                    if (!stops || stops.length === 0) break;
                    clearSelection();
                    navigate(stops[0]);
                    break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        focusMode, filter, expandedGroups, tasks,
        setFocusedId, toggleTask, archiveTask, toggleExpand, setExpandedAll,
        changeParent, batchChangeParent, batchComplete, batchMove,
        toggleUrgent, toggleImportant, setFocusMode, setQuickAddOpen,
        selectTask, clearSelection, setEditingTaskId,
        pushTodayToTomorrow, requestComplete
    ]);
}
