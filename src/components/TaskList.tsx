import React, { useRef, useEffect, useState } from 'react';
import { useTaskStore } from '../store/useTaskStore';
import { useUIStore } from '../store/useUIStore';
import { DndContext, closestCenter, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableTaskItem } from './SortableTaskItem';
import { toast } from './Toaster';

// Modular Components & Hooks
import { TaskItem } from './TaskList/TaskItem';
import { QuadBoard } from './TaskList/QuadBoard';
import { TaskListProps, VisibleTask } from './TaskList/types';
import { useVisibleTasks } from './TaskList/useVisibleTasks';
import { useTaskListKeyboard } from './TaskList/useTaskListKeyboard';
import { useTaskListDnd } from './TaskList/useTaskListDnd';

export const TaskList: React.FC<TaskListProps> = ({ filter }) => {
  const listRef = useRef<HTMLDivElement>(null);

  // Store State
  const {
    tasks,
    focusedId, setFocusedId,
    selectedIds,
    toggleTask, updateTask, deleteTask, toggleExpand, setExpandedAll
  } = useTaskStore();

  const {
    editingTaskId, setEditingTaskId,
    focusMode, setFocusMode,
    expandedGroups, toggleGroup,
  } = useUIStore();

  // 1. Calculate Visible Tasks
  const { visibleTasks, visibleTasksRef } = useVisibleTasks({ tasks, filter, expandedGroups });

  // 2. Setup Drag and Drop
  const {
    sensors,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    dragState,
    activeTask
  } = useTaskListDnd({ visibleTasks, filter });

  // 3. Setup Keyboard Navigation
  const focusedIdRef = useRef(focusedId);
  const selectedIdsRef = useRef(selectedIds);
  const editingTaskIdRef = useRef(editingTaskId);

  useEffect(() => { focusedIdRef.current = focusedId; }, [focusedId]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { editingTaskIdRef.current = editingTaskId; }, [editingTaskId]);

  // Completion celebration: hold the task on-screen briefly so the checkbox
  // animation is visible before it's filtered out of the list. Drives the
  // success-green burst for every completion path (click, swipe, keyboard X).
  const [celebratingId, setCelebratingId] = useState<string | null>(null);

  const requestComplete = (id: string) => {
    const t = useTaskStore.getState().tasks.find(x => x.id === id);
    if (!t) return;
    if (t.completed) { toggleTask(id); return; } // un-completing: instant, no fanfare
    setCelebratingId(id);
    window.setTimeout(() => {
      toggleTask(id);
      toast("Task completed", { label: "Undo", onClick: () => toggleTask(id) });
      setCelebratingId(null);
    }, 340);
  };

  useTaskListKeyboard({
    visibleTasksRef,
    focusedIdRef,
    selectedIdsRef,
    editingTaskIdRef,
    filter,
    expandedGroups,
    toggleGroup,
    requestComplete,
  });

  // 4. Focus Recovery & Auto-scroll
  const prevVisibleTasksRef = useRef<VisibleTask[]>(visibleTasks);
  useEffect(() => {
    const currentTasks = visibleTasks;
    const prevTasks = prevVisibleTasksRef.current;

    if (currentTasks.length === 0) {
      if (focusedId !== null) setFocusedId(null);
    } else if (focusedId !== null && !currentTasks.some(t => t.id === focusedId)) {
      const oldIndex = prevTasks.findIndex(t => t.id === focusedId);
      const newIndex = oldIndex !== -1 ? Math.min(oldIndex, currentTasks.length - 1) : 0;
      setFocusedId(currentTasks[newIndex].id);
    }
    prevVisibleTasksRef.current = currentTasks;
  }, [visibleTasks, focusedId, setFocusedId]);

  useEffect(() => {
    if (focusedId && focusMode === 'main' && !editingTaskId) {
      const el = document.getElementById(`task-${focusedId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [focusedId, focusMode, editingTaskId]);

  const handleToggle = (id: string, _currentlyCompleted: boolean) => requestComplete(id);

  if (visibleTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <p className="mb-2 text-lg">No tasks found</p>
        <div className="flex gap-4 text-xs font-mono">
          <span>Hit <kbd className="bg-slate-200 dark:bg-slate-800 px-1 rounded">Enter</kbd> to add</span>
        </div>
      </div>
    );
  }

  // --- TODAY: the Eisenhower quad board ---
  // No drag-and-drop here — u/i toggles move tasks between quadrants and
  // ⌘↑/⌘↓ reorders within one; dragging across a 2×2 grid earns nothing.
  if (filter === 'today') {
    return (
      <div ref={listRef} className="pb-24">
        <QuadBoard
          visibleTasks={visibleTasks}
          focusedId={focusedId}
          renderRow={(task, index) => (
            <TaskItem
              task={task}
              index={index}
              isFocused={focusedId === task.id}
              isSelected={selectedIds.includes(task.id)}
              isCelebrating={celebratingId === task.id}
              isEditing={editingTaskId === task.id}
              focusMode={focusMode}
              paddingLeft="0.5rem"
              setFocusedId={setFocusedId}
              setFocusMode={setFocusMode}
              toggleExpand={toggleExpand}
              handleToggle={handleToggle}
              filter={filter}
              tasks={tasks}
              updateTask={updateTask}
              setEditingTaskId={setEditingTaskId}
              expandedGroups={expandedGroups}
              toggleGroup={toggleGroup}
            />
          )}
        />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { }}
    >
      <div ref={listRef} className="pb-24">
        <SortableContext
          items={visibleTasks.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {visibleTasks.map((task, index) => (
            <SortableTaskItem key={task.id} id={task.id}>
              {({ isDragging, isOver, attributes, listeners }) => (
                <TaskItem
                  task={task}
                  index={index}
                  isFocused={focusedId === task.id}
                  isSelected={selectedIds.includes(task.id)}
                  isCelebrating={celebratingId === task.id}
                  isEditing={editingTaskId === task.id}
                  focusMode={focusMode}
                  paddingLeft={`${task.depth * 1.5}rem`}
                  setFocusedId={setFocusedId}
                  setFocusMode={setFocusMode}
                  toggleExpand={toggleExpand}
                  handleToggle={handleToggle}
                  filter={filter}
                  tasks={tasks}
                  updateTask={updateTask}
                  setEditingTaskId={setEditingTaskId}
                  isDragging={isDragging}
                  isOver={isOver}
                  attributes={attributes}
                  listeners={listeners}
                  dragState={dragState}
                  expandedGroups={expandedGroups}
                  toggleGroup={toggleGroup}
                />
              )}
            </SortableTaskItem>
          ))}
        </SortableContext>

        <DragOverlay dropAnimation={{
          duration: 250,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          sideEffects: {
            opacity: {
              active: 0.5,
            },
          },
        }}>
          {activeTask ? (
            <div className="opacity-90 scale-105 cursor-grabbing">
              <TaskItem
                task={activeTask}
                isFocused={activeTask.id === focusedId}
                isSelected={selectedIds.includes(activeTask.id)}
                isEditing={false}
                index={0}
                focusMode="main"
                paddingLeft={`${activeTask.depth * 1.5 + 0.75}rem`}
                setFocusedId={() => { }}
                setFocusMode={() => { }}
                toggleExpand={() => { }}
                handleToggle={() => { }}
                filter={filter}
                tasks={tasks}
                updateTask={() => { }}
                setEditingTaskId={() => { }}
                isDragging={true}
              />
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
};