import { useMemo, useRef, useEffect } from 'react';
import { Task } from '../../types';
import { ViewFilter, buildTaskMap, buildChildrenMap, filterActive, flattenTree, filterToday, sortImportant, sortOutstandingForToday, filterUpcoming, sortUpcoming, createSectionHeader, getUpcomingBucketName } from '../../utils/taskSort';
import { VisibleTask } from './types';

interface UseVisibleTasksProps {
    tasks: Task[];
    filter: ViewFilter;
    expandedGroups: Set<string>;
}

export function useVisibleTasks({ tasks, filter, expandedGroups }: UseVisibleTasksProps) {
    const visibleTasks = useMemo(() => {
        const taskMap = buildTaskMap(tasks);

        // --- VIEW: ACTIVE (Inbox) ---
        if (filter === 'active') {
            const filtered = filterActive(tasks);
            const childrenMap = buildChildrenMap(filtered);
            return flattenTree(childrenMap);
        }

        // --- VIEW: TODAY ---
        if (filter === 'today') {
            const { important, outstanding } = filterToday(tasks);

            const importantSorted = sortImportant(important);
            const outstandingSorted = sortOutstandingForToday(outstanding);

            const result: VisibleTask[] = [];

            if (importantSorted.length > 0) {
                const headerId = 'header-important';
                result.push(createSectionHeader(headerId, 'Important', importantSorted.length));
                if (expandedGroups.has(headerId)) {
                    importantSorted.forEach(t => result.push({ ...t, depth: 0, hasChildren: false }));
                }
            }

            if (outstandingSorted.length > 0) {
                const headerId = 'header-outstanding';
                result.push(createSectionHeader(headerId, 'Other', outstandingSorted.length));
                if (expandedGroups.has(headerId)) {
                    outstandingSorted.forEach(t => result.push(t));
                }
            }

            return result;
        }

        // --- VIEW: UPCOMING ---
        if (filter === 'upcoming') {
            const upcoming = filterUpcoming(tasks);
            const sorted = sortUpcoming(upcoming, taskMap);

            const result: VisibleTask[] = [];
            const buckets = new Set<string>();
            const groups = new Map<string, Task[]>();

            // Build groups for counts
            sorted.forEach(t => {
                const bucket = getUpcomingBucketName(new Date(t.dueDate!));
                if (!groups.has(bucket)) groups.set(bucket, []);
                groups.get(bucket)!.push(t);
            });

            // Render based on sorted task order
            sorted.forEach(t => {
                const bucket = getUpcomingBucketName(new Date(t.dueDate!));
                if (buckets.has(bucket)) return;
                buckets.add(bucket);

                const groupTasks = groups.get(bucket) || [];
                const headerId = `header-${bucket}`;

                result.push(createSectionHeader(headerId, bucket, groupTasks.length));

                if (expandedGroups.has(headerId)) {
                    groupTasks.forEach(task => {
                        result.push({ ...task, depth: 0, hasChildren: false });
                    });
                }
            });

            return result;
        }

        return [];
    }, [tasks, filter, expandedGroups]);

    // Keep a ref for stable access in event handlers
    const visibleTasksRef = useRef(visibleTasks);
    useEffect(() => {
        visibleTasksRef.current = visibleTasks;
    }, [visibleTasks]);

    return { visibleTasks, visibleTasksRef };
}
