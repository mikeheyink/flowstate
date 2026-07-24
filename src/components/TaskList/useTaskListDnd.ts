import { useState, useRef } from 'react';
import {
    useSensor,
    useSensors,
    MouseSensor,
    TouchSensor,
    PointerSensor,
    DragEndEvent
} from '@dnd-kit/core';
import { useTaskStore } from '../../store/useTaskStore';
import { Task } from '../../types';
import { DragState, VisibleTask } from './types';

interface UseTaskListDndProps {
    visibleTasks: VisibleTask[];
    filter: string;
}

export function useTaskListDnd({ visibleTasks, filter }: UseTaskListDndProps) {
    const { changeParent, toggleExpand, moveTaskTo } = useTaskStore();

    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
    const [dragState, setDragState] = useState<DragState | null>(null);
    const dragStateRef = useRef<DragState | null>(null);
    const lastHapticRef = useRef<string | null>(null);

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    );

    const handleDragStart = (event: any) => {
        setActiveTaskId(event.active.id);
        setDragState(null);
        dragStateRef.current = null;
    };

    const handleDragMove = (event: any) => {
        const { active, over } = event;

        if (!over || !active || active.id === over.id) {
            if (dragState) setDragState(null);
            return;
        }

        const overNode = over.data?.current?.sortable?.node?.current;
        const node = overNode || document.querySelector(`[data-task-id="${over.id}"]`);

        if (!node) return;

        const rect = node.getBoundingClientRect();
        const activeRect = event.active.rect.current.translated;
        if (!activeRect) return;

        const activeCenterY = activeRect.top + activeRect.height / 2;
        const relativeY = activeCenterY - rect.top;
        const percentage = Math.max(0, Math.min(1, relativeY / rect.height));

        let newType: DragState['type'] = 'nest';
        if (percentage < 0.25) newType = 'insert-before';
        else if (percentage > 0.75) newType = 'insert-after';
        else newType = 'nest';

        const newState = { type: newType, targetId: over.id };

        if (!dragState || dragState.type !== newType || dragState.targetId !== over.id) {
            setDragState(newState);
            dragStateRef.current = newState;

            // Haptics
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                const key = `${over.id}-${newType}`;
                if (lastHapticRef.current !== key) {
                    navigator.vibrate(10);
                    lastHapticRef.current = key;
                }
            }
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        const finalDragState = dragStateRef.current;

        setActiveTaskId(null);
        setDragState(null);
        dragStateRef.current = null;
        lastHapticRef.current = null;

        if (active.id !== over?.id && over) {
            const activeTask = visibleTasks.find(t => t.id === active.id);
            const overTask = visibleTasks.find(t => t.id === over.id);

            if (activeTask && overTask) {
                // NOTE: the Today view renders the QuadBoard (no DnD mounted), so
                // in practice this only runs for 'project'-context views now. The
                // quad branch is kept for completeness should DnD return there.
                const isToday = filter === 'today';
                const context = isToday ? 'quad' : 'project';

                const getOrder = (t: Task | VisibleTask) => {
                    if (isToday) {
                        if ((t as VisibleTask).effectiveOrder !== undefined) return (t as VisibleTask).effectiveOrder!;
                        if (t.quadOrder !== undefined && t.quadOrder !== null) return t.quadOrder;
                        return t.order || 0;
                    }
                    return t.order || 0;
                };

                if (finalDragState && finalDragState.targetId === over.id) {
                    if (finalDragState.type === 'nest' && !isToday) {
                        if (activeTask.parentId !== overTask.id) {
                            changeParent(activeTask.id, overTask.id);
                            if (!overTask.expanded) toggleExpand(overTask.id);
                        }
                    } else if (finalDragState.type === 'insert-before' || finalDragState.type === 'insert-after') {
                        const newParentId = isToday ? (activeTask.parentId || null) : overTask.parentId;
                        const targetOrder = getOrder(overTask);
                        let newOrder = finalDragState.type === 'insert-before' ? targetOrder - 5000 : targetOrder + 5000;
                        moveTaskTo(activeTask.id, newParentId, newOrder, { context });
                    }
                } else {
                    // Fallback: Standard Reorder
                    const newParentId = isToday ? (activeTask.parentId || null) : overTask.parentId;
                    const oldIndex = visibleTasks.findIndex(t => t.id === active.id);
                    const newIndex = visibleTasks.findIndex(t => t.id === over.id);
                    const targetOrder = getOrder(overTask);
                    let newOrder = oldIndex < newIndex ? targetOrder + 5000 : targetOrder - 5000;
                    moveTaskTo(activeTask.id, newParentId, newOrder, { context });
                }
            }
        }
    };

    const activeTask = activeTaskId ? visibleTasks.find(t => t.id === activeTaskId) : null;

    return {
        sensors,
        handleDragStart,
        handleDragMove,
        handleDragEnd,
        dragState,
        dragStateRef,
        activeTaskId,
        setActiveTaskId,
        activeTask
    };
}
