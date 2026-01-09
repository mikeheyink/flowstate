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

interface DragState {
  type: 'nest' | 'insert-before' | 'insert-after';
  targetId: string;
}


interface TaskListProps {
  filter: 'active' | 'today' | 'upcoming';
}

interface VisibleTask extends Task {
  depth: number;
  hasChildren: boolean;
  isHeader?: boolean;
  effectiveOrder?: number;
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
  isSelected,
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
  dragState,
  index,
}: {

  task: VisibleTask;
  isFocused: boolean;
  isSelected?: boolean;
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
  dragState?: DragState | null;
  index: number;

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

  // Visuals for Magnetic Drop based on dragState
  const isNestTarget = dragState?.type === 'nest' && dragState.targetId === task.id;
  const isInsertBefore = dragState?.type === 'insert-before' && dragState.targetId === task.id;
  const isInsertAfter = dragState?.type === 'insert-after' && dragState.targetId === task.id;

  // Header Rendering
  if (task.isHeader) {
    return (
      <div className="pt-8 pb-3 px-4 md:px-0 flex items-center gap-2" data-task-id={task.id}>
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{task.title}</h3>
        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800/50" />
      </div>
    );
  }

  const handleDragEnd = (_: any, info: any) => {

    if (info.offset.x > 80) { // Threshold for complete
      handleToggle(task.id, task.completed);
    }
  };

  return (
    <div
      {...(!isMobile ? { ...attributes, ...listeners } : {})}
      className="relative group"
      data-task-id={task.id}
    >
      {/* Swipe Completion Background Layer */}
      <motion.div
        style={{ opacity, background }}
        className="absolute inset-0 flex items-center justify-start pl-4 pointer-events-none"
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
              relative flex items-center h-12 pr-4 transition-all duration-200 cursor-pointer 
              border-b border-slate-100 dark:border-slate-800/50
              ${index % 2 !== 0 ? 'bg-white dark:bg-slate-900/40' : 'bg-transparent'}
              ${task.depth === 0 && filter === 'active' ? '!border-t-4 !border-t-slate-200 dark:!border-t-slate-800' : ''} 
              ${isFocused && focusMode === 'main' && !isSelected ? 'bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-800 shadow-sm z-10' : ''}
              ${isFocused && focusMode === 'sidebar' ? 'bg-slate-100 dark:bg-slate-800/20' : ''}
              ${isSelected ? 'bg-primary-100 dark:bg-primary-900/40 ring-1 ring-primary-500 dark:ring-primary-400 z-10' : ''}
              ${!isFocused && !isSelected ? 'hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}
              ${task.completed ? 'opacity-50' : 'opacity-100'}
              ${isOver && !isDragging && !isNestTarget ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/10 scale-[1.02] z-20' : ''}
              ${isNestTarget ? 'ring-2 ring-primary-500 bg-primary-100 dark:bg-primary-900/30 scale-[1.02] z-30' : ''}
            `}

        onClick={(e) => {
          e.stopPropagation();
          setFocusedId(task.id);
          setFocusMode('main');
        }}
      >
        <div className="flex-1 flex items-center min-w-0" style={{ paddingLeft: `calc(${paddingLeft} + 0.5rem)` }}>
          {/* Insert Lines */}
          {isInsertBefore && <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-50 shadow-[0_0_4px_rgba(59,130,246,0.5)]" />}
          {isInsertAfter && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 z-50 shadow-[0_0_4px_rgba(59,130,246,0.5)]" />}

          {/* Focus Indicator (Left Border) */}
          {isFocused && (
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${focusMode === 'main' ? 'bg-primary-500' : 'bg-slate-400 dark:bg-slate-600'}`} />
          )}

          {/* Expansion Toggle */}
          <div
            className={`w-6 h-6 flex items-center justify-center shrink-0 cursor-pointer mr-2 transition-all active:scale-90 ${task.expanded ? 'text-slate-500 dark:text-slate-400' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400'}`}
            onClick={(e) => {
              e.stopPropagation();
              if (task.hasChildren) toggleExpand(task.id);
            }}
          >
            {task.hasChildren ? (
              task.expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
            ) : null}
          </div>

          {/* Checkbox - Desktop only, mobile uses swipe */}
          {!isMobile && (
            <button
              onClick={(e) => { e.stopPropagation(); handleToggle(task.id, task.completed); }}
              className={`p-1 transition-colors shrink-0 mr-3 group/cb ${task.completed ? 'text-primary-600 dark:text-primary-500' : 'text-slate-300 dark:text-slate-600 hover:text-primary-500 dark:hover:text-primary-400'}`}
            >
              {task.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
            </button>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            {isEditing ? (
              <InlineEdit task={task} updateTask={updateTask} setEditingTaskId={setEditingTaskId} />
            ) : (
              <>
                {/* Context Eyebrow (Above Title) */}
                {filter !== 'active' && task.parentId && (
                  (() => {
                    // Quick parent lookup (could be memoized but list is virtualized/small enough usually)
                    const getParents = (currentTask: Task): string[] => {
                      const parents: string[] = [];
                      let curr = currentTask;
                      // Limit depth to avoid infinite loops if cycle exists (safety)
                      let depth = 0;
                      while (curr.parentId && depth < 10) {
                        const parent = tasks.find(t => t.id === curr.parentId);
                        if (parent) {
                          parents.unshift(parent.title);
                          curr = parent;
                          depth++;
                        } else {
                          break;
                        }
                      }
                      return parents;
                    };
                    const path = getParents(task);
                    if (path.length === 0) return null;
                    return (
                      <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400/80 dark:text-slate-500/80 truncate w-full leading-none mb-0.5">
                        {path.join(' > ')}
                      </div>
                    );
                  })()
                )}

                <div className="flex items-center gap-2">
                  <h3 className={`text-sm font-medium truncate transition-all ${task.completed ? 'text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                    {task.title}
                  </h3>
                  {task.notes && (
                    <AlignLeft className="w-3 h-3 text-slate-400 shrink-0" />
                  )}
                </div>
              </>
            )}
          </div>

          {/* Metadata & Actions (Right Aligned) */}
          <div className="flex items-center gap-4 pl-4 shrink-0">
            {task.importantOrder && (
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white shadow-sm ring-2 ring-amber-200 dark:ring-amber-900/50">
                <span className="text-[10px] font-bold">{task.importantOrder}</span>
              </div>
            )}

            {(task.dueDate || (task.tags && task.tags.length > 0)) && (
              <div className="flex items-center gap-3 text-xs text-slate-500">
                {task.dueDate && (
                  <span className={`flex items-center gap-1.5 ${new Date(task.dueDate) < new Date() && !task.completed ? 'text-red-500 dark:text-red-400' : ''}`}>
                    <span className="hidden md:inline">{formatDate(task.dueDate)}</span>
                    <span className="md:hidden"><Calendar className="w-3 h-3" /></span>
                  </span>
                )}
                {(task.tags || []).map(tag => (
                  <span key={tag} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] tracking-wide uppercase font-medium">
                    <span className="opacity-50">#</span>{tag}
                  </span>
                ))}
              </div>
            )}
            <div className="w-4 flex justify-center">
              <PriorityIcon priority={task.priority} />
            </div>

            {/* Grip Handle - Mobile: drag handle for reorder. Desktop: Hidden */}
            <div
              {...(isMobile ? { ...attributes, ...listeners } : {})}
              className={`md:hidden text-slate-300 dark:text-slate-600 cursor-grab active:cursor-grabbing hover:text-slate-500 p-1 ${isMobile ? 'touch-none' : ''}`}
            >
              <GripVertical className="w-4 h-4" />
            </div>
          </div>
        </div>
      </motion.div>
    </div >
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
  const toggleImportance = useTaskStore((state) => state.toggleImportance);
  const clearImportance = useTaskStore((state) => state.clearImportance);

  // Selection & Batch Actions
  const selectedIds = useTaskStore((state) => state.selectedIds);
  const selectTask = useTaskStore((state) => state.selectTask);
  const clearSelection = useTaskStore((state) => state.clearSelection);
  const batchMove = useTaskStore((state) => state.batchMove);
  const batchDelete = useTaskStore((state) => state.batchDelete);
  const batchComplete = useTaskStore((state) => state.batchComplete);

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
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // 1. Build Helpers for Hierarchy Sort
    // We need a map to quickly look up sort paths
    // Path = [GrandparentOrder, ParentOrder, TaskOrder]
    const taskMap = new Map<string, Task>();
    tasks.forEach(t => taskMap.set(t.id, t));

    const getSortPath = (task: Task): number[] => {
      const path: number[] = [];
      let current: Task | undefined = task;
      while (current) {
        // Use order or createdAt for stability
        path.unshift(current.order ?? -current.createdAt);
        if (current.parentId) {
          current = taskMap.get(current.parentId);
        } else {
          current = undefined;
        }
      }
      return path;
    };

    const compareHierarchy = (a: Task, b: Task) => {
      const pathA = getSortPath(a);
      const pathB = getSortPath(b);
      const len = Math.min(pathA.length, pathB.length);
      for (let i = 0; i < len; i++) {
        if (pathA[i] !== pathB[i]) return pathA[i] - pathB[i];
      }
      return pathA.length - pathB.length;
    };

    // --- VIEW: PLAN (Inbox) ---
    if (filter === 'active') {
      let filtered = tasks.filter(t => !t.archived && !t.completed);

      // Standard Tree Build
      const result: VisibleTask[] = [];
      const childrenMap = new Map<string | null, Task[]>();

      // Sort siblings first
      filtered.sort((a, b) => (a.order ?? -a.createdAt) - (b.order ?? -b.createdAt));

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
          result.push({ ...child, depth, hasChildren: hasChildren });
          if (child.expanded && hasChildren) build(child.id, depth + 1);
        }
      };

      build(null, 0);
      return result;
    }

    // --- VIEW: TODAY ---
    if (filter === 'today') {
      const candidates = tasks.filter(t => !t.archived && t.dueDate);

      const important: Task[] = [];
      const outstanding: Task[] = [];
      const completedToday: Task[] = [];

      candidates.forEach(t => {
        const d = new Date(t.dueDate!);
        // Reset times for date comparisons
        const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

        if (t.completed) {
          // Complete & Due Today
          if (dDate.getTime() === startOfToday.getTime()) {
            completedToday.push(t);
          }
        } else {
          // Incomplete & (Due Today OR Overdue)
          if (dDate < endOfToday) {
            if (t.importantOrder) {
              important.push(t);
            } else {
              outstanding.push(t);
            }
          }
        }
      });

      // Sort Important: By importantOrder
      important.sort((a, b) => (a.importantOrder || 0) - (b.importantOrder || 0));

      // FIXED: Today View Sorting - Completely Decoupled from Hierarchy
      // 
      // The key insight: dnd-kit's SortableContext expects the `items` array 
      // to match the visual order. If we sort by hierarchy first, then by todayOrder,
      // the arrays get out of sync and drops are rejected.
      //
      // Solution: Sort ONLY by todayOrder. Tasks without todayOrder get a stable
      // default based on their position in the initial (overdue-first) sort.

      // Step 1: Initial stable sort for tasks WITHOUT todayOrder
      // This determines the "natural" position for unordered tasks
      const hasOrder = (t: Task) => t.todayOrder !== undefined && t.todayOrder !== null;

      const withOrder = outstanding.filter(hasOrder);
      const withoutOrder = outstanding.filter(t => !hasOrder(t));

      // Sort unordered tasks: overdue first, then by createdAt for stability
      withoutOrder.sort((a, b) => {
        const dateA = new Date(a.dueDate!);
        const dateB = new Date(b.dueDate!);
        const isOverdueA = dateA < startOfToday;
        const isOverdueB = dateB < startOfToday;

        if (isOverdueA !== isOverdueB) return isOverdueA ? -1 : 1;

        // Use createdAt for stable ordering (not hierarchy!)
        return a.createdAt - b.createdAt;
      });

      // Sort ordered tasks by their todayOrder
      withOrder.sort((a, b) => (a.todayOrder || 0) - (b.todayOrder || 0));

      // Step 2: Calculate effectiveOrder for ALL tasks
      // Find the max todayOrder to place unordered tasks after ordered ones
      const maxOrder = withOrder.length > 0
        ? Math.max(...withOrder.map(t => t.todayOrder || 0))
        : 0;

      // Assign effectiveOrder to ordered tasks (use their actual todayOrder)
      const orderedVisible: VisibleTask[] = withOrder.map(t => ({
        ...t,
        depth: 0,
        hasChildren: false,
        effectiveOrder: t.todayOrder!
      }));

      // Assign effectiveOrder to unordered tasks (place after ordered ones)
      const unorderedVisible: VisibleTask[] = withoutOrder.map((t, i) => ({
        ...t,
        depth: 0,
        hasChildren: false,
        effectiveOrder: maxOrder + ((i + 1) * 10000) // Wide spacing after existing orders
      }));

      // Step 3: Merge and final sort ONLY by effectiveOrder
      const outstandingVisible = [...orderedVisible, ...unorderedVisible];
      outstandingVisible.sort((a, b) => (a.effectiveOrder || 0) - (b.effectiveOrder || 0));

      // Sort Completed: Hierarchy
      completedToday.sort(compareHierarchy);

      const result: VisibleTask[] = [];

      if (important.length > 0) {
        // Optional: Header for Important? Spec says "grouped separately... potentially with colored number... top of list"
        // Let's add a subtle header or just put them on top.
        // Spec: "grouped seperately from the other tasks and be at the top of the list"
        result.push({ id: 'header-important', title: 'Start Here', depth: 0, hasChildren: false, isHeader: true, completed: false } as any);
        important.forEach(t => result.push({ ...t, depth: 0, hasChildren: false }));
      }

      if (outstandingVisible.length > 0) {
        result.push({ id: 'header-outstanding', title: 'Outstanding', depth: 0, hasChildren: false, isHeader: true, completed: false } as any);
        // Push sorted outstandingVisible
        outstandingVisible.forEach(t => result.push(t));
      }

      if (completedToday.length > 0) {
        result.push({ id: 'header-complete', title: 'Complete', depth: 0, hasChildren: false, isHeader: true, completed: false } as any);
        completedToday.forEach(t => result.push({ ...t, depth: 0, hasChildren: false }));
      }

      return result;
    }

    // --- VIEW: UPCOMING ---
    if (filter === 'upcoming') {
      const upcoming = tasks.filter(t => {
        if (t.archived || t.completed || !t.dueDate) return false;
        const d = new Date(t.dueDate);
        return d >= endOfToday; // Tomorrow onwards
      });

      // Sort: Due Date ASC, then Hierarchy
      upcoming.sort((a, b) => {
        const dateA = new Date(a.dueDate!).getTime();
        const dateB = new Date(b.dueDate!).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return compareHierarchy(a, b);
      });

      // Bucket Logic
      const result: VisibleTask[] = [];
      let currentBucket = '';

      const getBucketName = (date: Date): string => {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const tomorrow = new Date(endOfToday); // endOfToday is actually start of tomorrow (00:00)

        // Tomorrow?
        if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';

        // Next 7 Days? (Approx check)
        const diffDays = Math.round((d.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 7) {
          return d.toLocaleDateString('en-US', { weekday: 'long' }); // e.g., "Monday"
        }

        // Future
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); // e.g., "February 2026"
      };

      upcoming.forEach(t => {
        const bucket = getBucketName(new Date(t.dueDate!));
        if (bucket !== currentBucket) {
          currentBucket = bucket;
          result.push({
            id: `header-${bucket}`,
            title: bucket,
            depth: 0,
            hasChildren: false,
            isHeader: true,
            completed: false,
            // Add dummy task props to satisfy type if needed, or use 'as any' safely since it's a header
          } as any);
        }
        result.push({ ...t, depth: 0, hasChildren: false });
      });

      return result;
    }

    return [];
  }, [tasks, filter]);

  // Clear focus when filter changes
  useEffect(() => {
    setFocusedId(null);
  }, [filter, setFocusedId]);

  const visibleTasksRef = useRef(visibleTasks);
  const focusedIdRef = useRef(focusedId);
  const editingTaskIdRef = useRef(editingTaskId);
  const selectedIdsRef = useRef(selectedIds);

  useEffect(() => { visibleTasksRef.current = visibleTasks; }, [visibleTasks]);
  useEffect(() => { focusedIdRef.current = focusedId; }, [focusedId]);
  useEffect(() => { editingTaskIdRef.current = editingTaskId; }, [editingTaskId]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);

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
      const currentSelectedIds = selectedIdsRef.current;

      const currentIndex = currentTasks.findIndex(t => t.id === currentId);
      const currentTask = currentTasks[currentIndex];

      const navigate = (newIndex: number) => {
        if (newIndex >= 0 && newIndex < currentTasks.length) {
          const taskId = currentTasks[newIndex].id;
          setFocusedId(taskId);
          // Scroll the focused task into view
          setTimeout(() => {
            const element = document.querySelector(`[data-task-id="${taskId}"]`);
            element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 0);
        }
      };

      const key = e.key.toLowerCase();
      const isShift = e.shiftKey;
      const isCmd = e.metaKey || e.ctrlKey;

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
        case 'arrowdown':
          e.preventDefault();
          if (isCmd) {
            if (currentSelectedIds.length > 1) batchMove('down');
            else if (currentId) moveTask(currentId, 'down');
            return;
          }
          if (isShift) {
            // Selection Mode
            if (currentId && !currentSelectedIds.includes(currentId)) selectTask(currentId, true);
            if (currentIndex === -1 && currentTasks.length > 0) {
              navigate(0);
              selectTask(currentTasks[0].id, true);
            } else {
              navigate(currentIndex + 1);
              if (currentIndex + 1 < currentTasks.length) selectTask(currentTasks[currentIndex + 1].id, true);
            }
            return;
          }
          // Normal Nav - Clear selection if exists
          if (currentSelectedIds.length > 0) clearSelection();

          if (currentIndex === -1 && currentTasks.length > 0) navigate(0);
          else navigate(currentIndex + 1);
          break;
        case 'arrowup':
          e.preventDefault();
          if (isCmd) {
            if (currentSelectedIds.length > 1) batchMove('up');
            else if (currentId) moveTask(currentId, 'up');
            return;
          }
          if (isShift) {
            // Selection Mode
            if (currentId && !currentSelectedIds.includes(currentId)) selectTask(currentId, true);
            if (currentIndex === -1 && currentTasks.length > 0) {
              navigate(currentTasks.length - 1);
              selectTask(currentTasks[currentTasks.length - 1].id, true);
            } else {
              navigate(currentIndex - 1);
              // Check bounds
              if (currentIndex - 1 >= 0) selectTask(currentTasks[currentIndex - 1].id, true);
            }
            return;
          }
          // Normal Nav - Clear selection if exists
          if (currentSelectedIds.length > 0) clearSelection();

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
        case 'space': e.preventDefault(); /* Space reserved for other uses or no-op */ break;
        case 'e': if (currentId && !isCmd) { e.preventDefault(); setEditingTaskId(currentId); } break;
        case 'n': if (currentId) { e.preventDefault(); const note = prompt("Edit Note", currentTask?.notes || ""); if (note !== null) updateTask(currentId, { notes: note }); } break;
        case 'enter':
          if (isCmd) { if (currentId) setQuickAddOpen(true, currentId); }
          else { if (currentId) setQuickAddOpen(true, currentTask.parentId || null, 'create', currentId); else setQuickAddOpen(true); }
          break;
        case 'tab':
          e.preventDefault();
          if (currentSelectedIds.length > 1) {
            // Batch Indent/Outdent
            const tasksToIndent = currentTasks.filter(t => currentSelectedIds.includes(t.id));
            // Sort Top-to-Bottom
            tasksToIndent.sort((a, b) => currentTasks.indexOf(a) - currentTasks.indexOf(b));

            if (isShift) { // Outdent
              const updates: { id: string, newParentId: string | null }[] = [];
              tasksToIndent.forEach(t => {
                if (t.parentId) {
                  const parent = tasks.find(pt => pt.id === t.parentId);
                  // Move to parent's parent
                  updates.push({ id: t.id, newParentId: parent?.parentId || null });
                }
              });
              useTaskStore.getState().batchChangeParent(updates);
            } else { // Indent
              const updates: { id: string, newParentId: string | null }[] = [];
              // Toggle parents separately (acceptable side effect separation) or could allow batching too, 
              // but expansion is less critical to undo group.
              tasksToIndent.forEach(t => {
                const idx = currentTasks.findIndex(ct => ct.id === t.id);
                if (idx > 0) {
                  const prev = currentTasks[idx - 1];
                  if (prev.depth === t.depth || prev.depth > t.depth) { // standard constraint
                    updates.push({ id: t.id, newParentId: prev.id });
                    if (!prev.expanded) toggleExpand(prev.id);
                  }
                }
              });
              useTaskStore.getState().batchChangeParent(updates);
            }
            return;
          }
          // Single Task Logic
          if (!currentId) return;
          if (isShift) { if (currentTask.parentId) { const parent = tasks.find(t => t.id === currentTask.parentId); changeParent(currentId, parent?.parentId || null); } }
          else {
            if (currentIndex > 0) {
              const prevTask = currentTasks[currentIndex - 1];
              if (prevTask.depth === currentTask.depth || prevTask.depth > currentTask.depth) { changeParent(currentId, prevTask.id); if (!prevTask.expanded) toggleExpand(prevTask.id); }
            }
          }
          break;
        case 'x':
          if (currentSelectedIds.length > 1) { batchComplete(); }
          else if (currentId) toggleTask(currentId);
          break;
        case 'delete':
        case 'backspace':
          if (currentSelectedIds.length > 1) { e.preventDefault(); batchDelete(); }
          else if (currentId && !editingTaskId) { e.preventDefault(); deleteTask(currentId); }
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
    // Stable dependencies provided by Zustand or standard hooks
    setFocusedId, toggleTask, deleteTask, moveTask, toggleExpand, setExpandedAll,
    setQuickAddOpen, focusMode, setFocusMode, changeParent, updateTask,
    selectTask, clearSelection, batchMove, batchDelete, batchComplete,
    toggleImportance, clearImportance,
    // Note: 'tasks' is usually stable enough if we rely on 'visibleTasksRef', 
    // but changeParent uses 'tasks'. Ideally we should pass tasks via Ref too if 'tasks' changes often.
    // But 'tasks' is only used in Tab logic. Refactoring that to use visibleTasksRef or similar is safer.
    // For now, removing 'tasks' from dep might break 'Tab' if it relies on stale tasks closure?
    // Actually, 'tasks' is used in Tab logic: `const parent = tasks.find(...)`.
    // Let's rely on `visibleTasksRef` or just accept that Tab logic might be slightly stale if not used carefully,
    // OR, better, use 'useTaskStore.getState().tasks' inside handler if possible? 
    // But we have 'tasks' from hook.
    // Let's add 'tasks' to a ref too to be safe?
    // Yes, let's make a tasksRef.
    tasks
  ]);

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
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const lastHapticRef = useRef<string | null>(null);


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
    setDragState(null);
    dragStateRef.current = null;
  };


  const handleDragMove = (event: any) => {
    const { active, over } = event;

    if (!over || !active || active.id === over.id) {
      if (dragState) setDragState(null);
      return;
    }

    const overNode = over.data?.current?.sortable?.node?.current; // Ensure we get the node from Sortable
    // Fallback if not sortable node
    const node = overNode || document.querySelector(`[data-task-id="${over.id}"]`);

    if (!node) return;

    const rect = node.getBoundingClientRect();
    // Use pointer coordinates for more precision on mobile? 
    // dnd-kit provides geometry in collisions but `event.delta` is relative?
    // Actually we can get pointer coordinates? Typically we rely on the `activatorEvent` or custom collision logic.
    // However, `dnd-kit` doesn't pass pointer coordinates directly in onDragMove easily without custom sensors/modifiers.
    // BUT checking standard approach: We want relative Y within the target.
    // We can use `event.active.rect.current.translated` vs `event.over.rect`.

    // Simplest approach: Use `active` rect center vs `over` rect.
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
        // Prevent spamming
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

    // Clear state
    setActiveTaskId(null);
    setDragState(null);
    dragStateRef.current = null;
    lastHapticRef.current = null;

    if (active.id !== over?.id && over) {
      const activeTask = visibleTasks.find(t => t.id === active.id);
      const overTask = visibleTasks.find(t => t.id === over.id);

      if (activeTask && overTask) {
        // Determine context and field
        const isToday = filter === 'today';
        const context = isToday ? 'today' : 'project';
        // If today, use todayOrder. If it's missing, we default to 0? Or what?
        // Note: Sort logic implies un-ordered items are sorted by priority/hierarchy.
        // If we drop explicit, we must give explicit value.
        // If neighbor has no todayOrder, we might need to initialize it?
        // Robust strategy: If target has no order, initialize it (and maybe neighbors)?
        // For MVP: assume existing order or 0 is start point.
        // Actually, if we sort by priority/order fallback, the "visual" order is what matters.
        // But numeric gap calculation requires numbers.
        const getOrder = (t: Task | VisibleTask) => {
          if (isToday) {
            // Use effectiveOrder if available (casted from VisibleTask)
            if ((t as VisibleTask).effectiveOrder !== undefined) return (t as VisibleTask).effectiveOrder!;
            // Fallback to todayOrder
            if (t.todayOrder !== undefined && t.todayOrder !== null) return t.todayOrder;
            // Final fallback (should have been covered by effectiveOrder)
            return t.order || 0;
          }
          return t.order || 0;
        };

        if (finalDragState && finalDragState.targetId === over.id) {
          // Priority: Use the calculated Zone state
          if (finalDragState.type === 'nest' && !isToday) {
            if (activeTask.parentId !== overTask.id) {
              changeParent(activeTask.id, overTask.id);
              if (!overTask.expanded) toggleExpand(overTask.id);
            }
          } else if (finalDragState.type === 'insert-before' || finalDragState.type === 'insert-after') {
            const newParentId = isToday ? (activeTask.parentId || null) : overTask.parentId;

            const targetOrder = getOrder(overTask);
            let newOrder = targetOrder;

            // In Today view, calculate gap based on neighbors if possible, or large steps?
            // "Effective Order" is spaced by 10000. 
            // If we insert, we want +/- 5000? 
            if (finalDragState.type === 'insert-before') {
              newOrder = targetOrder - 5000;
            } else {
              newOrder = targetOrder + 5000;
            }

            moveTaskTo(activeTask.id, newParentId, newOrder, { context });
          }
        } else {
          // Fallback: Standard Reorder
          const newParentId = isToday ? (activeTask.parentId || null) : overTask.parentId;
          const oldIndex = visibleTasks.findIndex(t => t.id === active.id);
          const newIndex = visibleTasks.findIndex(t => t.id === over.id);

          const targetOrder = getOrder(overTask);
          let newOrder = targetOrder;

          if (oldIndex < newIndex) {
            newOrder = targetOrder + 5000;
          } else {
            newOrder = targetOrder - 5000;
          }

          moveTaskTo(activeTask.id, newParentId, newOrder, { context });
        }
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
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setActiveTaskId(null); setDragState(null); dragStateRef.current = null; }}
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
                  dragState={dragStateRef.current}
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