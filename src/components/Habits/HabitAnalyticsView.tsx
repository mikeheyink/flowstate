import React, { useMemo } from 'react';
import { useHabitStore } from '../../store/useHabitStore';
import { useUIStore } from '../../store/useUIStore';
import { useObjectiveStore } from '../../store/useObjectiveStore';
import { getISOWeek, shiftWeek } from '../../utils/habitDates';
import { Habit } from '../../types';

/**
 * Habit analytics — "my day, scored".
 *
 * Layout: a hero strip (this week's ring vs goal · streak · per-objective
 * rollup chips), then one row per habit — in the same time-of-day order as the
 * grid/checklist — each with a 12-week heat-strip, success % and best streak.
 * Struggling habits aren't a separate section; they're simply *visible* as
 * orange rows. Fully responsive: everything is a vertical list on mobile.
 */

interface WeekCell {
    week: string;
    rate: number | null; // success rate 0..100, null = nothing evaluated
}

interface HabitStats {
    habit: Habit;
    cells: WeekCell[];
    totalDone: number;
    totalEvaluated: number;
    rate: number | null; // overall 12-week success rate
    bestStreak: number; // best consecutive run of clean weeks (no crosses)
}

function getPreviousWeeks(count: number = 12): string[] {
    const thisWeek = getISOWeek(new Date());
    return Array.from({ length: count }, (_, i) => shiftWeek(thisWeek, -(count - 1 - i)));
}

export function HabitAnalyticsView() {
    const getWeekStatsFunc = useHabitStore((state) => state.getWeekStats);
    const getLogsForHabitInWeek = useHabitStore((state) => state.getLogsForHabitInWeek);
    const allHabits = useHabitStore((state) => state.habits);
    const habitLogs = useHabitStore((state) => state.habitLogs); // subscribe: recompute on toggles
    const globalHabitGoal = useUIStore((state) => state.globalHabitGoal);
    const objectives = useObjectiveStore((state) => state.objectives);

    const habits = useMemo(
        () => allHabits
            .filter((h) => !h.archivedAt)
            .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt) || a.createdAt - b.createdAt),
        [allHabits]
    );
    const objectiveById = useMemo(() => new Map(objectives.map(o => [o.id, o])), [objectives]);

    const weeks = useMemo(() => getPreviousWeeks(12), []);
    const thisWeek = weeks[weeks.length - 1];

    // Per-habit stats over the 12-week window.
    const habitStats = useMemo<HabitStats[]>(() => {
        return habits.map((habit) => {
            let totalDone = 0;
            let totalEvaluated = 0;
            let bestStreak = 0;
            let run = 0;

            const cells: WeekCell[] = weeks.map((week) => {
                const logs = getLogsForHabitInWeek(habit.id, week);
                const done = logs.filter((l) => l.status === 'done').length;
                const failed = logs.filter((l) => l.status === 'failed').length;
                const evaluated = done + failed;

                totalDone += done;
                totalEvaluated += evaluated;

                if (evaluated > 0) {
                    // A clean week = at least one tick, zero crosses.
                    if (failed === 0) { run++; bestStreak = Math.max(bestStreak, run); }
                    else run = 0;
                }

                return { week, rate: evaluated > 0 ? Math.round((done / evaluated) * 100) : null };
            });

            return {
                habit,
                cells,
                totalDone,
                totalEvaluated,
                rate: totalEvaluated > 0 ? Math.round((totalDone / totalEvaluated) * 100) : null,
                bestStreak,
            };
        });
    }, [habits, weeks, getLogsForHabitInWeek, habitLogs]);

    // Hero: this week's success rate + streak of goal-met weeks.
    const thisWeekStats = useMemo(() => getWeekStatsFunc(thisWeek), [getWeekStatsFunc, thisWeek, allHabits, habitLogs]);

    const goalStreak = useMemo(() => {
        let streak = 0;
        for (let i = weeks.length - 1; i >= 0; i--) {
            const stats = getWeekStatsFunc(weeks[i]);
            if (stats.evaluated === 0) continue; // unmarked week: doesn't extend or break
            if (stats.percentage >= globalHabitGoal) streak++;
            else break;
        }
        return streak;
    }, [weeks, getWeekStatsFunc, globalHabitGoal, allHabits, habitLogs]);

    // Per-objective rollup over the last 4 weeks — the values report card.
    const objectiveRollup = useMemo(() => {
        const recent = weeks.slice(-4);
        const byObjective = new Map<string, { done: number; evaluated: number }>();

        for (const { habit } of habitStats) {
            if (!habit.objectiveId || !objectiveById.has(habit.objectiveId)) continue;
            const acc = byObjective.get(habit.objectiveId) ?? { done: 0, evaluated: 0 };
            for (const week of recent) {
                const logs = getLogsForHabitInWeek(habit.id, week);
                acc.done += logs.filter((l) => l.status === 'done').length;
                acc.evaluated += logs.filter((l) => l.status !== 'pending').length;
            }
            byObjective.set(habit.objectiveId, acc);
        }

        return [...byObjective.entries()]
            .map(([id, { done, evaluated }]) => ({
                objective: objectiveById.get(id)!,
                rate: evaluated > 0 ? Math.round((done / evaluated) * 100) : null,
            }))
            .filter((r) => r.rate !== null)
            .sort((a, b) => a.objective.order - b.objective.order);
    }, [habitStats, weeks, getLogsForHabitInWeek, objectiveById, habitLogs]);

    // 12-week trend (kept, but labeled and with the goal line drawn).
    const weekStats = useMemo(
        () => weeks.map((w) => ({ week: w, ...getWeekStatsFunc(w) })),
        [weeks, getWeekStatsFunc, allHabits, habitLogs]
    );

    const ringCircumference = 2 * Math.PI * 26;
    const ringPct = thisWeekStats.evaluated > 0 ? thisWeekStats.percentage : 0;
    const ringOffset = ringCircumference * (1 - ringPct / 100);
    const goalMet = thisWeekStats.evaluated > 0 && thisWeekStats.percentage >= globalHabitGoal;

    const cellClass = (rate: number | null) =>
        rate === null
            ? 'bg-slate-200/60 dark:bg-slate-800'
            : rate >= globalHabitGoal
                ? 'bg-success-500'
                : rate >= globalHabitGoal / 2
                    ? 'bg-amber-400'
                    : 'bg-orange-500';

    if (habits.length === 0) {
        return (
            <div className="p-6 max-w-3xl mx-auto text-center py-16 text-slate-500 dark:text-slate-400">
                No habits yet — add some and the analytics will build themselves.
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-3xl mx-auto pb-28">
            {/* ── Hero strip ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-5 md:gap-8 mb-8">
                {/* This week's ring vs goal */}
                <div className="relative flex-shrink-0" title={`This week: ${ringPct}% success (goal ${globalHabitGoal}%)`}>
                    <svg width="72" height="72" viewBox="0 0 64 64" className="-rotate-90">
                        <circle cx="32" cy="32" r="26" fill="none" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="6" />
                        <circle
                            cx="32" cy="32" r="26" fill="none"
                            className={goalMet ? 'stroke-success-500' : 'stroke-amber-500'}
                            strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={ringCircumference}
                            strokeDashoffset={ringOffset}
                            style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }}
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">
                            {thisWeekStats.evaluated > 0 ? `${ringPct}%` : '—'}
                        </span>
                    </div>
                </div>

                <div className="min-w-0">
                    <div className="flex items-baseline gap-4">
                        <div>
                            <div className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                                {goalStreak}<span className="text-base font-semibold text-slate-400">w</span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">streak ≥ {globalHabitGoal}%</div>
                        </div>
                        <div>
                            <div className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                                {habits.length}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">active habits</div>
                        </div>
                    </div>

                    {/* Per-objective rollup — the values report card (last 4 weeks) */}
                    {objectiveRollup.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                            {objectiveRollup.map(({ objective, rate }) => (
                                <span
                                    key={objective.id}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                    title={`${objective.title}: ${rate}% success over the last 4 weeks`}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: objective.color }} />
                                    {objective.title}
                                    <span className="tabular-nums font-semibold">{rate}%</span>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Per-habit rows: my day, scored ─────────────────────────── */}
            <div className="mb-10">
                <div className="flex items-baseline justify-between mb-2 px-1">
                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Habits · last 12 weeks</h3>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">old → new</span>
                </div>
                <div className="divide-y divide-slate-200/70 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 overflow-hidden">
                    {habitStats.map(({ habit, cells, rate, bestStreak }) => {
                        const objective = habit.objectiveId ? objectiveById.get(habit.objectiveId) : undefined;
                        return (
                            <div
                                key={habit.id}
                                // flex-wrap: on narrow screens the heat strip wraps below
                                // the title instead of crushing it into "Morn…".
                                className="relative flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3"
                                title={[objective?.title, habit.why].filter(Boolean).join(' — ') || undefined}
                            >
                                {objective && (
                                    <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full" style={{ backgroundColor: objective.color }} />
                                )}
                                <div className="basis-full sm:basis-auto sm:flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{habit.title}</div>
                                    <div className="text-[11px] text-slate-400 dark:text-slate-500">
                                        {habit.type === 'do' ? '✓ do' : '✗ avoid'}
                                        {bestStreak > 0 && <span> · best {bestStreak}w clean</span>}
                                    </div>
                                </div>

                                {/* 12-week heat strip */}
                                <div className="flex items-center gap-[3px] flex-shrink-0">
                                    {cells.map(({ week, rate: r }) => (
                                        <span
                                            key={week}
                                            className={`w-2.5 h-5 rounded-[3px] ${cellClass(r)}`}
                                            title={`${week}: ${r === null ? 'no data' : `${r}%`}`}
                                        />
                                    ))}
                                </div>

                                <div className={`w-11 text-right text-sm font-bold tabular-nums flex-shrink-0 ${rate === null
                                    ? 'text-slate-300 dark:text-slate-600'
                                    : rate >= globalHabitGoal
                                        ? 'text-success-500'
                                        : 'text-orange-500'
                                    }`}>
                                    {rate === null ? '—' : `${rate}%`}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── 12-week trend ──────────────────────────────────────────── */}
            <div>
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2 px-1">Weekly trend</h3>
                <div className="relative flex items-end gap-1 h-28 bg-slate-100/60 dark:bg-slate-800/40 p-3 pt-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    {/* Goal line */}
                    <div
                        className="absolute left-3 right-3 border-t border-dashed border-slate-400/60 dark:border-slate-500/60 pointer-events-none"
                        style={{ bottom: `calc(0.75rem + 1rem + (100% - 1.75rem - 1rem) * ${globalHabitGoal / 100})` }}
                    >
                        <span className="absolute -top-2 right-0 text-[9px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                            {globalHabitGoal}%
                        </span>
                    </div>
                    {weekStats.map((stat) => {
                        const hasData = stat.evaluated > 0;
                        const met = hasData && stat.percentage >= globalHabitGoal;
                        return (
                            <div key={stat.week} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                                <div
                                    className={`w-full rounded-t ${!hasData ? 'bg-slate-300 dark:bg-slate-700' : met ? 'bg-success-500' : 'bg-orange-400'}`}
                                    style={{ height: `${hasData ? Math.max(stat.percentage, 3) : 3}%` }}
                                    title={`Week ${stat.week}: ${hasData ? `${stat.percentage}% (${stat.done}✓ / ${stat.failed}✗)` : 'no data'}`}
                                />
                                <div className="text-[9px] text-slate-500 dark:text-slate-400">W{stat.week.split('-W')[1]}</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
