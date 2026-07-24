import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { Habit, Objective } from '../../types';
import { MiniMarkdown } from '../../utils/miniMarkdown';

/**
 * The "why" layer for a habit row:
 *  - ObjectiveEdge: a stacked set of colored segments (one per linked objective)
 *    on the row's left edge — a habit can serve several objectives at once.
 *  - HabitDetailButton: an ⓘ affordance that reveals a card with the objective
 *    names + the full multi-line detail. Opens on hover (desktop) and on
 *    click/tap (works on touch, where hover doesn't exist).
 */

export function ObjectiveEdge({ objectives, className = '' }: { objectives: Objective[]; className?: string }) {
    if (objectives.length === 0) return null;
    return (
        <span className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full overflow-hidden flex flex-col ${className}`}>
            {objectives.map((o) => (
                <span key={o.id} className="flex-1" style={{ backgroundColor: o.color }} />
            ))}
        </span>
    );
}

export function habitHasDetail(habit: Habit, objectives: Objective[]): boolean {
    return !!(habit.why && habit.why.trim()) || objectives.length > 0;
}

export function HabitDetailButton({
    habit,
    objectives,
    className = '',
}: {
    habit: Habit;
    objectives: Objective[];
    className?: string;
}) {
    const [open, setOpen] = useState(false);
    if (!habitHasDetail(habit, objectives)) return null;

    return (
        <span
            className={`relative inline-flex ${className}`}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
        >
            {/* Rendered as a span (not a button): these rows are themselves
                <button>s in the checklist view, and nested buttons are invalid. */}
            <span
                role="button"
                tabIndex={0}
                aria-label="Habit detail"
                onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); setOpen((v) => !v); } }}
                className="inline-flex text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400 transition-colors cursor-pointer"
            >
                <Info className="w-3.5 h-3.5" />
            </span>

            {open && (
                <>
                    {/* Tap-away scrim (mobile) — click outside closes */}
                    <span
                        className="fixed inset-0 z-40 md:hidden"
                        onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                    />
                    <span
                        onClick={(e) => e.stopPropagation()}
                        // Opens rightward (left-aligned to the ⓘ): these triggers
                        // sit just after the habit title on the left of the row,
                        // so a right-anchored card would clip off-screen.
                        className="absolute z-50 left-0 top-6 w-64 max-w-[80vw] p-3 rounded-xl bg-white dark:bg-slate-850 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700 text-left cursor-default"
                    >
                        {objectives.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                                {objectives.map((o) => (
                                    <span
                                        key={o.id}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: o.color }} />
                                        {o.title}
                                    </span>
                                ))}
                            </div>
                        )}
                        {habit.why && habit.why.trim() && (
                            <MiniMarkdown
                                text={habit.why}
                                className="text-xs leading-relaxed text-slate-600 dark:text-slate-300"
                            />
                        )}
                    </span>
                </>
            )}
        </span>
    );
}
