import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { CheckCircle2, Circle, Calendar, Hash, Flag, ChevronRight, ChevronDown, GripVertical } from 'lucide-react';
import { Task, Priority } from '../../types';
import { FocusMode } from '../../store/useUIStore';
import { formatDate } from '../../utils/nlp';
import { SectionHeader } from '../SectionHeader';
import { InlineEdit } from './InlineEdit';
import { DragState, VisibleTask } from './types';

const PriorityIcon = ({ priority }: { priority: Priority }) => {
    switch (priority) {
        case 1: return <Flag className="w-4 h-4 text-red-500 fill-red-500/20" />;
        case 2: return <Flag className="w-4 h-4 text-yellow-500 fill-yellow-500/20" />;
        case 3: return <Flag className="w-4 h-4 text-blue-500 fill-blue-500/20" />;
        default: return null;
    }
};

// Build full parent path string (e.g., "Project > Feature > Subtask")
const getParentPath = (task: VisibleTask, allTasks: Task[]): string => {
    const path: string[] = [];
    let current = allTasks.find(t => t.id === task.parentId);
    while (current) {
        path.unshift(current.title);
        current = allTasks.find(t => t.id === current?.parentId);
    }
    return path.join(' > ') || '...';
};

interface TaskItemProps {
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
    expandedGroups?: Set<string>;
    toggleGroup?: (id: string) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({
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
    expandedGroups,
    toggleGroup,
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
        const isExpanded = (expandedGroups && expandedGroups.has(task.id));

        return (
            <div data-task-id={task.id} className="mb-1">
                <SectionHeader
                    title={task.title}
                    count={(task as any).count}
                    isExpanded={isExpanded}
                    isFocused={isFocused}
                    onToggle={toggleGroup ? () => toggleGroup(task.id) : undefined}
                />
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
                style={{ x, touchAction: "pan-y", paddingLeft }}
                className={`
          relative flex items-center h-12 pr-4 transition-all duration-200 cursor-pointer 
          border-b border-slate-100 dark:border-slate-800/50
          ${index % 2 !== 0 ? 'bg-white dark:bg-slate-900/40' : 'bg-transparent'}
          ${isFocused ? 'ring-1 ring-inset ring-blue-500/50 bg-blue-50/30 dark:bg-blue-900/10' : ''}
          ${isSelected ? 'bg-blue-100/50 dark:bg-blue-900/20' : ''}
          ${isDragging ? 'opacity-30 scale-95 blur-[1px]' : ''}
        `}
                onClick={() => {
                    setFocusedId(task.id);
                    setFocusMode('main');
                }}
            >
                {/* Drop Indicators */}
                {isInsertBefore && <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-20 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />}
                {isInsertAfter && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 z-20 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />}
                {isNestTarget && <div className="absolute inset-0 border-2 border-blue-500 border-dashed rounded-md z-20 pointer-events-none" />}

                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleToggle(task.id, task.completed);
                        }}
                        className="flex-shrink-0 focus:outline-none"
                    >
                        {task.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500 fill-green-500/10" />
                        ) : (
                            <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 hover:text-slate-400 dark:hover:text-slate-500 transition-colors" />
                        )}
                    </button>

                    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2">
                            {isEditing ? (
                                <InlineEdit
                                    task={task}
                                    updateTask={updateTask}
                                    setEditingTaskId={setEditingTaskId}
                                />
                            ) : (
                                <>
                                    <span className={`text-sm font-medium truncate ${task.completed ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-slate-100'}`}>
                                        {task.title}
                                    </span>
                                    <PriorityIcon priority={task.priority} />
                                    {task.hasChildren && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleExpand(task.id);
                                            }}
                                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                        >
                                            {task.expanded ? (
                                                <ChevronDown className="w-3 h-3 text-slate-400" />
                                            ) : (
                                                <ChevronRight className="w-3 h-3 text-slate-400" />
                                            )}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Task Meta */}
                        {!isEditing && (
                            <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                                {/* Show due date only in Active/Review views */}
                                {task.dueDate && (filter === 'active' || filter === 'review') && (
                                    <div className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        <span>{formatDate(task.dueDate)}</span>
                                    </div>
                                )}
                                {task.tags.length > 0 && (
                                    <div className="flex items-center gap-1">
                                        <Hash className="w-3 h-3 text-slate-300" />
                                        <span>{task.tags.join(', ')}</span>
                                    </div>
                                )}
                                {/* Show parent path in Today/Upcoming views */}
                                {task.parentId && (filter === 'today' || filter === 'upcoming') && (
                                    <div className="flex items-center gap-1 text-slate-300 italic truncate max-w-[200px]">
                                        <span>{getParentPath(task, tasks)}</span>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            </motion.div>
        </div>
    );
};
