import React, { useEffect, useRef, useState } from 'react';
import { useTaskStore } from '../store/useTaskStore';
import { useUIStore } from '../store/useUIStore';
import { Task, Priority } from '../types';
import { CheckCircle2, Circle, Calendar, Hash, Flag, ChevronRight, ChevronDown, CornerDownRight, AlignLeft, GripVertical } from 'lucide-react';
import { formatDate } from '../utils/nlp';
import { toast } from './Toaster';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { FocusMode } from '../store/useUIStore';
import { DndContext, DragEndEvent, TouchSensor, MouseSensor, PointerSensor, useSensor, useSensors, closestCenter, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableTaskItem } from './SortableTaskItem';

// ... (Existing Interfaces and Components: TaskListProps, VisibleTask, PriorityIcon) ...

interface TaskListProps {
  filter: 'all' | 'active' | 'completed' | 'today';
}

interface VisibleTask extends Task {
  depth: number;
  hasChildren: boolean;
}

const PriorityIcon = ({ priority }: { priority: Priority }) => {
  switch (priority) {
    case 1: return <Flag className="w-4 h-4 text-red-500 fill-red-500/20" />;
    case 2: return <Flag className="w-4 h-4 text-yellow-500 fill-yellow-500/20" />;
    case 3: return <Flag className="w-4 h-4 text-blue-500 fill-blue-500/20" />;
    default: return null;
  }
};

// ... InlineEdit ...
const InlineEdit = ({
  task,
  updateTask,
  setEditingTaskId
}: {
  task: Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  setEditingTaskId: (id: string | null) => void;
}) => {
  const [val, setVal] = useState(task.title);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);

  const save = () => {
    if (val.trim()) updateTask(task.id, { title: val });
    setEditingTaskId(null);
  };

  return (
    <input
      ref={ref}
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={save}
      onKeyDown={e => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') setEditingTaskId(null);
        e.stopPropagation(); // Prevent global listeners
      }}
      className="flex-1 bg-transparent text-sm font-medium outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400"
    />
  )
};

// ... TaskItem ...
const TaskItem = ({
  task,
  isFocused,
  isEditing,
  focusMode,
  paddingLeft,
  setFocusedId,
  setFocusMode,
  toggleExpand,
  handleToggle,
  filter,
  tasks,
  updateTask,
  setEditingTaskId,
  isDragging,
  isOver,
  attributes,
  listeners,
}: {
  task: VisibleTask;
  isFocused: boolean;
  isEditing: boolean;
  focusMode: FocusMode;
  paddingLeft: string;
  setFocusedId: (id: string) => void;
  setFocusMode: (mode: FocusMode) => void;
  toggleExpand: (id: string) => void;
  handleToggle: (id: string, currentlyCompleted: boolean) => void;
  filter: string;
  tasks: Task[];
  updateTask: (id: string, updates: Partial<Task>) => void;
  setEditingTaskId: (id: string | null) => void;
  isDragging?: boolean;
  isOver?: boolean;
  attributes?: any;
  listeners?: any;
}) => {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [0, 50, 100], [0, 0, 1]);
  const background = useTransform(x, [0, 100], ["rgba(22, 163, 74, 0)", "rgba(22, 163, 74, 0.2)"]);

  // Detect mobile viewport - disable Framer Motion drag on mobile so dnd-kit works
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 80) { // Threshold for complete
      handleToggle(task.id, task.completed);
    }
  };

  return (
    <div
      {...(!isMobile ? { ...attributes, ...listeners } : {})}
      className="relative mb-1 group"
    >
      {/* Swipe Completion Background Layer */}
      <motion.div
        style={{ opacity, background }}
        className="absolute inset-0 rounded-lg flex items-center justify-start pl-4 pointer-events-none"
      >
        <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-500" />
      </motion.div>

      {/* Task Card - Swipeable for completion */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ right: 0.5 }}
        onDragEnd={handleDragEnd}
        whileDrag={{ scale: 1.02, zIndex: 10 }}
        style={{ x, touchAction: "pan-y" }}
        className={`
              relative flex flex-col py-2.5 pr-3 rounded-r-lg transition-all duration-200 cursor-pointer 
              bg-slate-50 dark:bg-slate-950
              ${isFocused && focusMode === 'main' ? 'bg-slate-200 dark:bg-slate-800/60 ring-1 ring-slate-300 dark:ring-slate-700 shadow-lg' : ''}
              ${isFocused && focusMode === 'sidebar' ? 'bg-slate-100 dark:bg-slate-800/20' : ''}
              ${!isFocused ? 'group-hover:bg-slate-100 dark:group-hover:bg-slate-900' : ''}
              ${task.completed ? 'opacity-50' : 'opacity-100'}
              ${isOver && !isDragging ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/10 scale-[1.02] z-10' : ''}
            `}
        onClick={(e) => {
          e.stopPropagation();
          setFocusedId(task.id);
          setFocusMode('main');
        }}
      >
        <div style={{ paddingLeft }}>
          {/* Focus Indicator (Left Border) */}
          {isFocused && (
            <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full ${focusMode === 'main' ? 'bg-primary-500' : 'bg-slate-400 dark:bg-slate-600'}`} />
          )}

          <div className="flex items-center gap-2">
            {/* Expansion Toggle */}
            <div
              className="w-8 h-8 flex items-center justify-center text-slate-400 dark:text-slate-500 shrink-0 cursor-pointer -ml-1 transition-transform active:scale-90"
              onClick={(e) => {
                e.stopPropagation();
                if (task.hasChildren) toggleExpand(task.id);
              }}
            >
              {task.hasChildren ? (
                task.expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
              ) : (
                task.depth > 0 && <CornerDownRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-700" />
              )}
            </div>

            {/* Checkbox - Desktop only, mobile uses swipe */}
            {!isMobile && (
              <button
                onClick={(e) => { e.stopPropagation(); handleToggle(task.id, task.completed); }}
                className="p-1.5 -m-1.5 text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors shrink-0"
              >
                {task.completed ? <CheckCircle2 className="w-5 h-5 text-primary-600 dark:text-primary-500" /> : <Circle className="w-5 h-5" />}
              </button>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              {/* Context Eyebrow */}
              {((filter !== 'all' && filter !== 'active') || task.depth === 0) && task.parentId && (
                (() => {
                  const getParents = (currentTask: Task): string[] => {
                    const parents: string[] = [];
                    let curr = currentTask;
                    while (curr.parentId) {
                      const parent = tasks.find(t => t.id === curr.parentId);
                      if (parent) {
                        parents.unshift(parent.title);
                        curr = parent;
                      } else {
                        break;
                      }
                    }
                    return parents;
                  };
                  const path = getParents(task);
                  if (path.length === 0) return null;

                  return (
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-medium mb-0.5">
                      {path.join(' / ')}
                    </div>
                  );
                })()
              )}

              {isEditing ? (
                <InlineEdit task={task} updateTask={updateTask} setEditingTaskId={setEditingTaskId} />
              ) : (
                <div className="group/title">
                  <h3 className={`text-sm font-medium truncate transition-all ${task.completed ? 'text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                    {task.title}
                  </h3>
                </div>
              )}
            </div>
            {/* Grip Handle - Mobile: drag handle for reorder. Desktop: visual only */}
            <div
              {...(isMobile ? { ...attributes, ...listeners } : {})}
              className={`text-slate-300 dark:text-slate-600 cursor-grab active:cursor-grabbing hover:text-slate-500 p-2 -m-2 ${isMobile ? 'touch-none' : ''}`}
            >
              <GripVertical className="w-4 h-4" />
            </div>
          </div>

          {/* Metadata & Actions */}
          <div className="flex items-center gap-3 pr-2 shrink-0 mt-1 ml-9">
            {(task.dueDate || (task.tags && task.tags.length > 0)) && (
              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                {task.dueDate && (
                  <span className={`flex items-center gap-1 ${new Date(task.dueDate) < new Date() && !task.completed ? 'text-red-500 dark:text-red-400' : ''}`}>
                    <Calendar className="w-2.5 h-2.5" />
                    {formatDate(task.dueDate)}
                  </span>
                )}
                {(task.tags || []).map(tag => (
                  <span key={tag} className="flex items-center gap-0.5 px-1 py-px rounded bg-slate-200 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400">
                    <Hash className="w-2.5 h-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <PriorityIcon priority={task.priority} />
          </div>

          {/* Notes Display */}
          {task.notes && (
            <div className="mt-1 ml-9 flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <AlignLeft className="w-3 h-3 mt-0.5 opacity-50" />
              <p className="line-clamp-2">{task.notes}</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export const TaskList: React.FC<TaskListProps> = ({ filter }) => {
  const tasks = useTaskStore((state) => state.tasks);
  const focusedId = useTaskStore((state) => state.focusedId);
  const setFocusedId = useTaskStore((state) => state.setFocusedId);
  const toggleTask = useTaskStore((state) => state.toggleTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const moveTask = useTaskStore((state) => state.moveTask);
  const toggleExpand = useTaskStore((state) => state.toggleExpand);
  const setExpandedAll = useTaskStore((state) => state.setExpandedAll);
  const moveTaskTo = useTaskStore((state) => state.moveTaskTo);

  // Debug Logging
  useEffect(() => {
    console.log('[TaskList] Tasks:', tasks);
  }, [tasks]);

  const changeParent = useTaskStore((state) => state.changeParent);
  const updateTask = useTaskStore((state) => state.updateTask);

  const setQuickAddOpen = useUIStore((state) => state.setQuickAddOpen);
  const focusMode = useUIStore((state) => state.focusMode);
  const setFocusMode = useUIStore((state) => state.setFocusMode);
  const editingTaskId = useUIStore((state) => state.editingTaskId);
  const setEditingTaskId = useUIStore((state) => state.setEditingTaskId);

  const listRef = useRef<HTMLDivElement>(null);

  // --- Recursive Tree Flattening ---
  const visibleTasks = React.useMemo(() => {
    let filtered = tasks.filter(t => !t.archived);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    if (filter === 'active') filtered = filtered.filter(t => !t.completed);
    if (filter === 'completed') filtered = filtered.filter(t => t.completed);
    if (filter === 'today') {
      filtered = filtered.filter(t => {
        if (t.completed) return false;
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        return d >= startOfToday && d < endOfToday;
      });
    }

    // Sort order
    filtered.sort((a, b) => {
      // 1. Completed at bottom
      if (a.completed !== b.completed) return a.completed ? 1 : -1;

      // 2. Explicit Order (or fallback to createdAt)
      const orderA = a.order ?? -a.createdAt;
      const orderB = b.order ?? -b.createdAt;

      return orderA - orderB;
    });

    // For 'completed' or 'today' filter, we want a flat list, ignoring hierarchy
    if (filter === 'completed' || filter === 'today') {
      return filtered.map(t => ({ ...t, depth: 0, hasChildren: false }));
    }

    const result: VisibleTask[] = [];
    const childrenMap = new Map<string | null, Task[]>();

    filtered.forEach(t => {
      const pid = t.parentId || 'root';
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid)?.push(t);
    });

    const build = (parentId: string | null, depth: number) => {
      const children = childrenMap.get(parentId || 'root');
      if (!children) return;

      for (const child of children) {
        const hasChildren = childrenMap.has(child.id) && (childrenMap.get(child.id)?.length || 0) > 0;

        result.push({
          ...child,
          depth,
          hasChildren
        });

        if (child.expanded && hasChildren) {
          build(child.id, depth + 1);
        }
      }
    };

    build(null, 0);
    return result;
  }, [tasks, filter]);

  // Clear focus when filter changes
  useEffect(() => {
    setFocusedId(null);
  }, [filter, setFocusedId]);

  const visibleTasksRef = useRef(visibleTasks);
  const focusedIdRef = useRef(focusedId);
  const editingTaskIdRef = useRef(editingTaskId);

  useEffect(() => { visibleTasksRef.current = visibleTasks; }, [visibleTasks]);
  useEffect(() => { focusedIdRef.current = focusedId; }, [focusedId]);
  useEffect(() => { editingTaskIdRef.current = editingTaskId; }, [editingTaskId]);

  // --- Auto-Focus Logic ---
  const prevVisibleTasksRef = useRef<VisibleTask[]>(visibleTasks);
  useEffect(() => {
    const currentTasks = visibleTasks;
    const prevTasks = prevVisibleTasksRef.current;
    const currentFocus = focusedId;

    if (currentTasks.length === 0) {
      if (currentFocus !== null) setFocusedId(null);
      prevVisibleTasksRef.current = currentTasks;
      return;
    }

    const isFocusValid = currentTasks.some(t => t.id === currentFocus);
    // Only attempt recovery if we HAD a focus that is now invalid
    if (currentFocus !== null && !isFocusValid) {
      const oldIndex = prevTasks.findIndex(t => t.id === currentFocus);
      if (oldIndex !== -1) {
        const newIndex = Math.min(oldIndex, currentTasks.length - 1);
        setFocusedId(currentTasks[newIndex].id);
      } else {
        setFocusedId(currentTasks[0].id);
      }
    }
    prevVisibleTasksRef.current = currentTasks;
  }, [visibleTasks, focusedId, setFocusedId]);


  // --- Keyboard Navigation ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (focusMode !== 'main') return;
      if (editingTaskIdRef.current) return;
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      const currentTasks = visibleTasksRef.current;
      const currentId = focusedIdRef.current;
      const currentIndex = currentTasks.findIndex(t => t.id === currentId);
      const currentTask = currentTasks[currentIndex];

      const navigate = (newIndex: number) => {
        if (newIndex >= 0 && newIndex < currentTasks.length) {
          setFocusedId(currentTasks[newIndex].id);
        }
      };

      const key = e.key.toLowerCase();
      const isShift = e.shiftKey;
      const isCmd = e.metaKey || e.ctrlKey;

      if (isShift && (key === 'l' || key === 'arrowright')) {
        e.preventDefault();
        setExpandedAll(true);
        return;
      }
      if (isShift && (key === 'h' || key === 'arrowleft')) {
        e.preventDefault();
        setExpandedAll(false);
        return;
      }

      switch (key) {
        case 'arrowdown':
          e.preventDefault();
          if (isCmd && currentId) {
            moveTask(currentId, 'down');
            return;
          }
          if (currentIndex === -1 && currentTasks.length > 0) navigate(0);
          else navigate(currentIndex + 1);
          break;
        case 'arrowup':
          e.preventDefault();
          if (isCmd && currentId) {
            moveTask(currentId, 'up');
            return;
          }
          if (currentIndex === -1 && currentTasks.length > 0) navigate(currentTasks.length - 1);
          else navigate(currentIndex - 1);
          break;
        case 'l': if (currentId && !isCmd) { e.preventDefault(); setQuickAddOpen(true, null, 'tag', currentId); } break;
        case 'arrowright': e.preventDefault(); if (currentTask) { if (currentTask.hasChildren && !currentTask.expanded) toggleExpand(currentTask.id); } break;
        case 'h': case 'arrowleft': e.preventDefault();
          if (currentTask) {
            if (currentTask.hasChildren && currentTask.expanded) toggleExpand(currentTask.id);
            else if (currentTask.depth > 0) { const parent = currentTasks.find(t => t.id === currentTask.parentId); if (parent) setFocusedId(parent.id); }
            else setFocusMode('sidebar');
          } else setFocusMode('sidebar');
          break;
        case 'space': e.preventDefault(); if (currentId) toggleTask(currentId); break;
        case 'e': if (currentId && !isCmd) { e.preventDefault(); setEditingTaskId(currentId); } break;
        case 'n': if (currentId) { e.preventDefault(); const note = prompt("Edit Note", currentTask?.notes || ""); if (note !== null) updateTask(currentId, { notes: note }); } break;
        case 'enter':
          if (isCmd) { if (currentId) setQuickAddOpen(true, currentId); }
          else { if (currentId) setQuickAddOpen(true, currentTask.parentId || null, 'create', currentId); else setQuickAddOpen(true); }
          break;
        case 'tab': e.preventDefault(); if (!currentId) return;
          if (isShift) { if (currentTask.parentId) { const parent = tasks.find(t => t.id === currentTask.parentId); changeParent(currentId, parent?.parentId || null); } }
          else {
            if (currentIndex > 0) {
              const prevTask = currentTasks[currentIndex - 1];
              if (prevTask.depth === currentTask.depth || prevTask.depth > currentTask.depth) { changeParent(currentId, prevTask.id); if (!prevTask.expanded) toggleExpand(prevTask.id); }
            }
          }
          break;
        case 'x': if (currentId) toggleTask(currentId); break;
        case 'd': if (currentId) { e.preventDefault(); setQuickAddOpen(true, null, 'date', currentId); } break;
        case 'o':
          if (isCmd && currentId) { e.preventDefault(); const text = (currentTask.title + " " + (currentTask.notes || "")); const match = text.match(/(https?:\/\/[^\s]+)/g); if (match && match[0]) window.open(match[0], '_blank'); }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setFocusedId, toggleTask, deleteTask, moveTask, toggleExpand, setExpandedAll, setQuickAddOpen, focusMode, setFocusMode, changeParent, editingTaskId, updateTask, tasks]);

  useEffect(() => {
    if (focusedId && focusMode === 'main' && !editingTaskId) {
      const el = document.getElementById(`task-${focusedId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [focusedId, focusMode, editingTaskId]);

  const handleToggle = (id: string, currentlyCompleted: boolean) => {
    toggleTask(id);
    if (!currentlyCompleted) {
      toast("Task completed", { label: "Undo", onClick: () => toggleTask(id) });
    }
  };

  // --- DND Logic ---
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 8,
      }
    }),
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      }
    })
  );

  const handleDragStart = (event: any) => {
    setActiveTaskId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTaskId(null);

    if (active.id !== over?.id && over) {
      const activeTask = visibleTasks.find(t => t.id === active.id);
      const overTask = visibleTasks.find(t => t.id === over.id);

      if (activeTask && overTask) {
        // Simple Reorder logic (adoption)
        const newParentId = overTask.parentId;
        const oldIndex = visibleTasks.findIndex(t => t.id === active.id);
        const newIndex = visibleTasks.findIndex(t => t.id === over.id);

        let newOrder = overTask.order || 0;
        if (oldIndex < newIndex) {
          newOrder = (overTask.order || 0) + 100;
        } else {
          newOrder = (overTask.order || 0) - 100;
        }

        moveTaskTo(activeTask.id, newParentId, newOrder);
      }
    }
  };

  const activeTask = activeTaskId ? visibleTasks.find(t => t.id === activeTaskId) : null;

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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTaskId(null)}
    >
      <div ref={listRef} className="pb-24">
        <SortableContext
          items={visibleTasks.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {visibleTasks.map((task) => (
            <SortableTaskItem key={task.id} id={task.id}>
              {({ isDragging, isOver, attributes, listeners }) => (
                <TaskItem
                  task={task}
                  isFocused={task.id === focusedId}
                  isEditing={task.id === editingTaskId}
                  focusMode={focusMode}
                  paddingLeft={`${task.depth * 1.5 + 0.75}rem`}
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
                />
              )}
            </SortableTaskItem>
          ))}
        </SortableContext>

        <DragOverlay dropAnimation={{
          duration: 250,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          dragSourceOpacity: 0.5,
        }}>
          {activeTask ? (
            <div className="opacity-90 scale-105 cursor-grabbing">
              <TaskItem
                task={activeTask}
                isFocused={activeTask.id === focusedId}
                isEditing={false}
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