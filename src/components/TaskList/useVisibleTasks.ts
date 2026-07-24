import { useMemo, useRef, useEffect } from 'react';
import { Task } from '../../types';
import { ViewFilter, buildTaskMap, buildChildrenMap, filterActive, flattenTree, filterTodayQuad, filterUpcoming, sortUpcoming, createSectionHeader, getUpcomingBucketName } from '../../utils/taskSort';
import { QUADRANTS } from '../../utils/quad';
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

        // --- VIEW: TODAY (Eisenhower quad) ---
        if (filter === 'today') {
            const groups = filterTodayQuad(tasks);
            const result: VisibleTask[] = [];

            // All four quadrants are always present (even empty): the desktop
            // board renders a panel per header, the 1–4 jumps need a target, and
            // reading order (Q1→Q4) doubles as the ↓/↑ navigation order. Quad
            // sections don't collapse — the board is the collapse.
            for (const q of QUADRANTS) {
                const items = groups[q.key];
                result.push(createSectionHeader(q.headerId, q.title, items.length));
                items.forEach(t => result.push({ ...t, depth: 0, hasChildren: false }));
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

                const header = createSectionHeader(headerId, bucket, groupTasks.length);
                // Tasks are sorted ascending by date, so the first is the earliest
                // day in this bucket — what a task added "to this group" should be due.
                if (groupTasks[0]?.dueDate) header.bucketDate = new Date(groupTasks[0].dueDate);
                result.push(header);

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
