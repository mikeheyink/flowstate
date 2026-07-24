import React from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { CheckCircle2, Circle, Calendar, Hash, ChevronRight, ChevronDown, GripVertical } from 'lucide-react';
import { Task } from '../../types';
import { FocusMode } from '../../store/useUIStore';
import { formatDate } from '../../utils/nlp';
import { SectionHeader } from '../SectionHeader';
import { InlineEdit } from './InlineEdit';
import { DragState, VisibleTask } from './types';
import { useIsMobile } from '../../hooks/useIsMobile';

/**
 * Eisenhower flag chip ("U" amber / "I" iris).
 * At rest a chip renders only when its flag is ON — hundreds of unflagged Plan
 * rows stay perfectly clean. On the *focused* row both chips render, unset ones
 * as faint outlines, so the full toggle state is visible exactly at the moment
 * of decision (u/i work from any view).
 */
const FlagChip = ({ kind, on }: { kind: 'urgent' | 'important'; on: boolean }) => {
    const palette = kind === 'urgent'
        ? (on
            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            : 'border border-amber-500/30 text-amber-500/50 dark:text-amber-400/40')
        : (on
            ? 'bg-primary-500/15 text-primary-600 dark:text-primary-400'
            : 'border border-primary-500/30 text-primary-500/50 dark:text-primary-400/40');
    return (
        <span
            className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded text-[10px] font-bold leading-none ${palette}`}
            title={kind === 'urgent' ? 'Urgent (U)' : 'Important (I)'}
        >
            {kind === 'urgent' ? 'U' : 'I'}
        </span>
    );
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
    isCelebrating?: boolean;
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
    isCelebrating,
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

    // On mobile we attach the swipe-to-complete gesture and drop dnd-kit's drag
    // listeners (touch reordering is desktop-only); on desktop both are wired up.
    const isMobile = useIsMobile();

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
        // Already mid-celebration (or completed)? Ignore — re-triggering the
        // completion while the row is being removed is a needless race.
        if (isCelebrating || task.completed) return;
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
          relative flex items-center h-[52px] pr-4 mx-2 rounded-xl transition-all duration-200 cursor-pointer
          ${isFocused ? 'bg-white dark:bg-slate-850 shadow-[0_1px_2px_rgba(40,30,15,0.06)] ring-1 ring-slate-200/70 dark:ring-slate-800' : 'bg-transparent hover:bg-slate-100/70 dark:hover:bg-slate-850/40'}
          ${isSelected ? 'bg-primary-600/5 dark:bg-primary-500/10' : ''}
          ${isCelebrating ? 'bg-success-500/10 dark:bg-success-500/10' : ''}
          ${isDragging ? 'opacity-30 scale-95 blur-[1px]' : ''}
        `}
                onClick={(e) => {
                    // Stop the click bubbling to the page-level "click empty space to
                    // deselect" handler, which would immediately clear this focus.
                    e.stopPropagation();
                    setFocusedId(task.id);
                    setFocusMode('main');
                }}
            >
                {/* Focused "you are here" accent bar */}
                {isFocused && <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-primary-600 dark:bg-primary-500 z-20" />}

                {/* Drop Indicators */}
                {isInsertBefore && <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-20 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />}
                {isInsertAfter && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 z-20 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />}
                {isNestTarget && <div className="absolute inset-0 border-2 border-blue-500 border-dashed rounded-md z-20 pointer-events-none" />}

                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {/* Drag handle: hover-revealed on desktop, hidden on mobile (no pointer hover, no touch reorder) */}
                    <GripVertical className="hidden md:block w-4 h-4 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />

                    {/* Completion control. Desktop: tappable checkbox. Mobile: there's no
                        checkbox — swipe the row right to complete (see the green reveal layer). */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleToggle(task.id, task.completed);
                        }}
                        className={`${isMobile ? 'hidden' : ''} relative flex-shrink-0 focus:outline-none`}
                    >
                        {(task.completed || isCelebrating) ? (
                            <motion.span
                                initial={isCelebrating ? { scale: 0.3 } : false}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 14 }}
                                className="block"
                            >
                                <CheckCircle2 className="w-5 h-5 text-success-500 fill-success-500/15" />
                            </motion.span>
                        ) : (
                            <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 hover:text-primary-500 dark:hover:text-primary-400 transition-colors" />
                        )}
                        {isCelebrating && (
                            <motion.span
                                initial={{ scale: 0.5, opacity: 0.7 }}
                                animate={{ scale: 2.4, opacity: 0 }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                                className="absolute inset-0 rounded-full ring-2 ring-success-500 pointer-events-none"
                            />
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
                                    <span className={`text-[14.5px] font-medium truncate ${task.completed ? 'text-slate-400 line-through decoration-success-500/70' : 'text-slate-900 dark:text-slate-100'}`}>
                                        {task.title}
                                    </span>
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
                            <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
                                {/* Show due date only in Active/Review views */}
                                {task.dueDate && (filter === 'active' || filter === 'review') && (
                                    <div className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        <span>{formatDate(task.dueDate)}</span>
                                    </div>
                                )}
                                {task.tags.length > 0 && (
                                    <div className="flex items-center gap-1 text-primary-500/80 dark:text-primary-400/80">
                                        <Hash className="w-3 h-3" />
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

                {/* Eisenhower flags, right-aligned. Mobile gets compact dots
                    (space is tight); desktop gets the U/I chips. */}
                {!isEditing && (
                    isMobile ? (
                        (task.urgent || task.important) && (
                            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                {task.urgent && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                                {task.important && <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />}
                            </div>
                        )
                    ) : (
                        (task.urgent || task.important || isFocused) && (
                            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                {(task.urgent || isFocused) && <FlagChip kind="urgent" on={!!task.urgent} />}
                                {(task.important || isFocused) && <FlagChip kind="important" on={!!task.important} />}
                            </div>
                        )
                    )
                )}
            </motion.div>
        </div>
    );
};
