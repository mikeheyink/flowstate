import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useTaskStore } from '../store/useTaskStore';
import { useUIStore } from '../store/useUIStore';
import { Task } from '../types';
import { CheckCircle2, ChevronRight, ChevronDown } from 'lucide-react';
import { formatDate } from '../utils/nlp';
import { SectionHeader } from './SectionHeader';

interface VisibleItem {
    type: 'week-header' | 'hierarchy-path' | 'task';
    id: string;
    title: string;
    depth: number;
    isExpanded?: boolean;
    hasChildren?: boolean;
    task?: Task;
    weekKey?: string;
    taskCount?: number;
}

// Helper: Get ISO week string
const getWeekKey = (date: Date): string => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
};

// Helper: Format week label
const formatWeekLabel = (weekKey: string): string => {
    const now = new Date();
    const thisWeek = getWeekKey(now);
    const lastWeekDate = new Date(now);
    lastWeekDate.setDate(now.getDate() - 7);
    const lastWeek = getWeekKey(lastWeekDate);

    if (weekKey === thisWeek) return 'This Week';
    if (weekKey === lastWeek) return 'Last Week';

    const [year, week] = weekKey.split('-W');
    return `Week ${parseInt(week)}, ${year}`;
};

// Helper: Get full parent path for a task
const getParentPath = (taskId: string | null | undefined, taskMap: Map<string, Task>): string[] => {
    const path: string[] = [];
    let currentId = taskId;
    let depth = 0;
    while (currentId && depth < 10) {
        const parent = taskMap.get(currentId);
        if (parent) {
            path.unshift(parent.title);
            currentId = parent.parentId;
            depth++;
        } else {
            break;
        }
    }
    return path;
};

export const WeeklyReview: React.FC = () => {
    const tasks = useTaskStore((state) => state.tasks);
    const focusedId = useTaskStore((state) => state.focusedId);
    const setFocusedId = useTaskStore((state) => state.setFocusedId);

    const focusMode = useUIStore((state) => state.focusMode);
    const setFocusMode = useUIStore((state) => state.setFocusMode);

    const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());
    const [initialized, setInitialized] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);

    // Build task map for lookups
    const taskMap = useMemo(() => {
        const map = new Map<string, Task>();
        tasks.forEach(t => map.set(t.id, t));
        return map;
    }, [tasks]);

    // Build week data (without expansion state to avoid circular dependency)
    const weekData = useMemo(() => {
        const completedTasks = tasks.filter(t => t.completed && t.completedAt && !t.archived);

        // Group by week
        const weekMap = new Map<string, { startDate: Date; tasks: Task[] }>();

        completedTasks.forEach(task => {
            const completedDate = new Date(task.completedAt!);
            const weekKey = getWeekKey(completedDate);

            if (!weekMap.has(weekKey)) {
                const d = new Date(completedDate);
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                d.setDate(diff);
                d.setHours(0, 0, 0, 0);
                weekMap.set(weekKey, { startDate: d, tasks: [] });
            }
            weekMap.get(weekKey)!.tasks.push(task);
        });

        // Sort weeks descending (most recent first)
        return Array.from(weekMap.entries())
            .sort((a, b) => b[1].startDate.getTime() - a[1].startDate.getTime())
            .map(([weekKey, data]) => ({
                weekKey,
                label: formatWeekLabel(weekKey),
                startDate: data.startDate,
                tasks: data.tasks.sort((a, b) => {
                    const aTime = new Date(a.completedAt!).getTime();
                    const bTime = new Date(b.completedAt!).getTime();
                    return bTime - aTime;
                }),
            }));
    }, [tasks]);

    // Initialize first week as expanded
    useEffect(() => {
        if (weekData.length > 0 && !initialized) {
            setExpandedWeeks(new Set([weekData[0].weekKey]));
            setInitialized(true);
        }
    }, [weekData, initialized]);

    // Toggle week expansion
    const toggleWeek = useCallback((weekKey: string) => {
        setExpandedWeeks(prev => {
            const next = new Set(prev);
            if (next.has(weekKey)) {
                next.delete(weekKey);
            } else {
                next.add(weekKey);
            }
            return next;
        });
    }, []);

    // Build visible items list
    const visibleItems = useMemo(() => {
        const items: VisibleItem[] = [];

        weekData.forEach(week => {
            const isExpanded = expandedWeeks.has(week.weekKey);

            // Week header
            items.push({
                type: 'week-header',
                id: `week-${week.weekKey}`,
                title: week.label,
                depth: 0,
                isExpanded,
                hasChildren: week.tasks.length > 0,
                weekKey: week.weekKey,
                taskCount: week.tasks.length,
            });

            if (isExpanded) {
                // Group tasks by their full hierarchy path
                const tasksByPath = new Map<string, Task[]>();

                week.tasks.forEach(task => {
                    const path = getParentPath(task.parentId, taskMap);
                    const pathKey = path.length > 0 ? path.join(' > ') : '__root__';

                    if (!tasksByPath.has(pathKey)) {
                        tasksByPath.set(pathKey, []);
                    }
                    tasksByPath.get(pathKey)!.push(task);
                });

                // Sort paths: root last, then alphabetically
                const sortedPaths = Array.from(tasksByPath.keys()).sort((a, b) => {
                    if (a === '__root__') return 1;
                    if (b === '__root__') return -1;
                    return a.localeCompare(b);
                });

                sortedPaths.forEach(pathKey => {
                    const tasksInPath = tasksByPath.get(pathKey)!;

                    // Add hierarchy header (unless root)
                    if (pathKey !== '__root__') {
                        items.push({
                            type: 'hierarchy-path',
                            id: `path-${week.weekKey}-${pathKey}`,
                            title: pathKey,
                            depth: 1,
                            hasChildren: true,
                        });
                    }

                    // Add tasks under this path
                    tasksInPath.forEach(task => {
                        items.push({
                            type: 'task',
                            id: task.id,
                            title: task.title,
                            depth: pathKey === '__root__' ? 1 : 2,
                            task,
                        });
                    });
                });
            }
        });

        return items;
    }, [weekData, expandedWeeks, taskMap]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (focusMode !== 'main') return;
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

            const currentIndex = visibleItems.findIndex(item => item.id === focusedId);
            const currentItem = visibleItems[currentIndex];

            const navigate = (newIndex: number) => {
                // Infinite Loop
                const safeIndex = (newIndex + visibleItems.length) % visibleItems.length;
                const itemId = visibleItems[safeIndex].id;
                setFocusedId(itemId);
                setTimeout(() => {
                    const element = document.querySelector(`[data-item-id="${itemId}"]`);
                    element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 0);
            };

            const key = e.key.toLowerCase();

            switch (key) {
                case 'arrowdown':
                case 'j':
                    e.preventDefault();
                    if (currentIndex === -1 && visibleItems.length > 0) navigate(0);
                    else navigate(currentIndex + 1);
                    break;
                case 'arrowup':
                case 'k':
                    e.preventDefault();
                    if (currentIndex === -1 && visibleItems.length > 0) navigate(visibleItems.length - 1);
                    else navigate(currentIndex - 1);
                    break;
                case 'arrowright':
                case 'l':
                    e.preventDefault();
                    if (currentItem) {
                        if (currentItem.type === 'week-header' && currentItem.weekKey) {
                            // Strict: Only Expand
                            if (!currentItem.isExpanded) {
                                toggleWeek(currentItem.weekKey);
                            }
                        }
                    }
                    break;
                case 'enter':
                case ' ':
                    if (currentItem?.type === 'week-header' && currentItem.weekKey) {
                        e.preventDefault();
                        toggleWeek(currentItem.weekKey);
                    }
                    break;
                case 'arrowleft':
                case 'h':
                    e.preventDefault();
                    if (currentItem?.type === 'week-header' && currentItem.weekKey) {
                        // Strict: Only Collapse
                        if (currentItem.isExpanded) {
                            toggleWeek(currentItem.weekKey);
                        }
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [focusMode, visibleItems, focusedId, setFocusedId, setFocusMode, toggleWeek]);

    // Set initial focus
    useEffect(() => {
        if (visibleItems.length > 0 && !focusedId) {
            setFocusedId(visibleItems[0].id);
        }
    }, [visibleItems, focusedId, setFocusedId]);

    if (weekData.length === 0) {
        return (
            <div className="text-center py-16">
                <CheckCircle2 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">No completed tasks</h3>
                <p className="text-sm text-slate-500 dark:text-slate-500">
                    Complete some tasks to see your weekly review
                </p>
            </div>
        );
    }

    return (
        <div ref={listRef} className="space-y-1">
            {visibleItems.map((item) => {
                const isFocused = focusedId === item.id;

                if (item.type === 'week-header') {
                    const isFocused = focusedId === item.id;
                    return (
                        <div
                            key={item.id}
                            data-item-id={item.id}
                        >
                            <SectionHeader
                                title={item.title}
                                count={item.taskCount}
                                isExpanded={item.isExpanded}
                                isFocused={isFocused && focusMode === 'main'}
                                onToggle={() => {
                                    if (item.weekKey) {
                                        setFocusedId(item.id);
                                        setFocusMode('main');
                                        toggleWeek(item.weekKey);
                                    }
                                }}
                            />
                        </div>
                    );
                } // End week-header

                if (item.type === 'hierarchy-path') {
                    return (
                        <div
                            key={item.id}
                            data-item-id={item.id}
                            onClick={() => {
                                setFocusedId(item.id);
                                setFocusMode('main');
                            }}
                            className={`
                flex items-center gap-2 py-2 pl-8 pr-4 text-sm font-medium cursor-pointer transition-all
                ${isFocused && focusMode === 'main'
                                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                }
              `}
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                            <span className="truncate">{item.title}</span>
                        </div>
                    );
                }

                if (item.type === 'task' && item.task) {
                    const task = item.task;
                    const paddingClass = item.depth === 2 ? 'pl-12' : 'pl-8';

                    return (
                        <div
                            key={item.id}
                            data-item-id={item.id}
                            onClick={() => {
                                setFocusedId(item.id);
                                setFocusMode('main');
                            }}
                            className={`
                flex items-center gap-3 py-2 ${paddingClass} pr-4 cursor-pointer transition-all
                ${isFocused && focusMode === 'main'
                                    ? 'bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-800'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                }
              `}
                        >
                            <CheckCircle2 className="w-4 h-4 text-primary-500 shrink-0" />
                            <span className="text-sm text-slate-600 dark:text-slate-300 truncate flex-1">
                                {task.title}
                            </span>

                            {/* Eisenhower flags at completion time */}
                            {task.urgent && (
                                <span className="text-[10px] font-bold text-amber-500" title="Was urgent">U</span>
                            )}
                            {task.important && (
                                <span className="text-[10px] font-bold text-primary-500" title="Was important">I</span>
                            )}

                            {/* Completion date */}
                            {task.completedAt && (
                                <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                                    {formatDate(task.completedAt)}
                                </span>
                            )}
                        </div>
                    );
                }

                return null;
            })}
        </div>
    );
};
