import React from 'react';
import { motion, LayoutGroup } from 'framer-motion';
import { QUADRANTS, QuadrantKey } from '../../utils/quad';
import { VisibleTask } from './types';

/**
 * The Eisenhower board — the Today view's layout.
 *
 * Receives the same flat visibleTasks list the keyboard hook navigates
 * (header-q1, …q1 tasks, header-q2, …) and lays it out as a 2×2 grid on
 * desktop / stacked sections on mobile (pure CSS, same DOM). Rows are wrapped
 * in layout-animated containers so a u/i toggle visibly *moves* the task to
 * its new quadrant instead of teleporting.
 *
 * Q2 ("Schedule" — important, not urgent) is the hero quadrant: it gets the
 * brand tint. That's where the objectives live; Q1 being loud is a failure
 * mode, not a goal.
 */

interface QuadStyle {
    dot: string;
    title: string;
    panel: string;
}

const QUAD_STYLES: Record<QuadrantKey, QuadStyle> = {
    q1: {
        dot: 'bg-rose-500',
        title: 'text-rose-600 dark:text-rose-400',
        panel: 'border-slate-200 dark:border-slate-800',
    },
    q2: {
        dot: 'bg-primary-500',
        title: 'text-primary-600 dark:text-primary-400',
        panel: 'border-primary-500/25 dark:border-primary-400/20 bg-primary-500/[0.04] dark:bg-primary-400/[0.05]',
    },
    q3: {
        dot: 'bg-amber-500',
        title: 'text-amber-600 dark:text-amber-400',
        panel: 'border-slate-200 dark:border-slate-800',
    },
    q4: {
        dot: 'bg-slate-400 dark:bg-slate-500',
        title: 'text-slate-500 dark:text-slate-400',
        // Slightly dimmed on purpose: if something lives here for days,
        // that's the delete/delegate signal.
        panel: 'border-slate-200 dark:border-slate-800 opacity-[0.92]',
    },
};

interface QuadBoardProps {
    visibleTasks: VisibleTask[];
    focusedId: string | null;
    renderRow: (task: VisibleTask, index: number) => React.ReactNode;
}

export function QuadBoard({ visibleTasks, focusedId, renderRow }: QuadBoardProps) {
    // Split the flat list into quadrant groups, preserving each task's global
    // index so focus/selection handlers keep working unchanged.
    const groups = QUADRANTS.map(def => ({ def, items: [] as { task: VisibleTask; index: number }[] }));
    let current = -1;
    visibleTasks.forEach((t, i) => {
        if (t.isHeader) {
            current = QUADRANTS.findIndex(q => q.headerId === t.id);
            return;
        }
        if (current >= 0) groups[current].items.push({ task: t, index: i });
    });

    return (
        <LayoutGroup>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-2 md:px-4 pt-1">
                {groups.map(({ def, items }) => {
                    const s = QUAD_STYLES[def.key];
                    const isQuadFocused = focusedId === def.headerId;
                    return (
                        <section
                            key={def.key}
                            aria-label={def.title}
                            className={`rounded-2xl border ${s.panel} bg-white/50 dark:bg-slate-900/40 flex flex-col min-h-[120px]`}
                        >
                            <header className="flex items-baseline gap-2 px-4 pt-3 pb-1 select-none">
                                <span className={`w-2 h-2 rounded-full ${s.dot} self-center flex-shrink-0`} />
                                <h3 className={`font-display font-semibold text-sm tracking-wide ${s.title}`}>
                                    {def.title}
                                </h3>
                                <span className="hidden sm:inline text-xs text-slate-400 dark:text-slate-500 truncate">
                                    {def.subtitle}
                                </span>
                                <span className="ml-auto text-xs tabular-nums text-slate-400 dark:text-slate-500">
                                    {items.length}
                                </span>
                                <kbd className="hidden md:inline px-1.5 py-0.5 text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-mono">
                                    {def.hotkey}
                                </kbd>
                            </header>

                            <div className="pb-2 flex-1">
                                {items.length === 0 ? (
                                    // An empty quadrant is still a focus stop, so arrowing
                                    // into it has to show *something* — this placeholder
                                    // stands in for the row that isn't there, and ↩ on it
                                    // creates a task with this quadrant's flags.
                                    <div
                                        data-task-id={def.headerId}
                                        className={`mx-2 px-2 py-4 rounded-lg text-xs italic transition-colors ${isQuadFocused
                                            ? 'bg-primary-500/10 dark:bg-primary-400/10 text-primary-600 dark:text-primary-400'
                                            : 'text-slate-300 dark:text-slate-600'
                                            }`}
                                    >
                                        {isQuadFocused ? 'Nothing here — ↩ to add' : 'Nothing here'}
                                    </div>
                                ) : (
                                    items.map(({ task, index }) => (
                                        <motion.div
                                            key={task.id}
                                            layoutId={`quad-${task.id}`}
                                            layout
                                            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                                        >
                                            {renderRow(task, index)}
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </section>
                    );
                })}
            </div>
        </LayoutGroup>
    );
}
