import React, { useMemo } from 'react';
import { useHabitStore } from '../../store/useHabitStore';
import { useUIStore } from '../../store/useUIStore';
import { useObjectiveStore } from '../../store/useObjectiveStore';
import { getISOWeek, shiftWeek } from '../../utils/habitDates';
import { Habit, Objective } from '../../types';
import { ObjectiveEdge, HabitDetailButton } from './HabitDetail';

/**
 * Habit analytics — "my day, scored", with the numbers actually legible.
 *
 * Order (top → bottom): the Weekly Trend chart (the hero, every week's score
 * printed), a compact stat line (this week · streak · active · per-objective
 * rollup), then one row per habit with a 12-week grid that shows each week's %
 * as a number — not just a color.
 */

interface WeekCell {
    week: string;
    rate: number | null; // success rate 0..100, null = nothing evaluated
}

interface HabitStats {
    habit: Habit;
    cells: WeekCell[];
    rate: number | null; // overall 12-week success rate
    bestStreak: number;
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
    const habitObjectives = (h: Habit): Objective[] =>
        (h.objectiveIds ?? []).map((id) => objectiveById.get(id)).filter((o): o is Objective => !!o);

    const weeks = useMemo(() => getPreviousWeeks(12), []);
    const thisWeek = weeks[weeks.length - 1];

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
                    if (failed === 0) { run++; bestStreak = Math.max(bestStreak, run); }
                    else run = 0;
                }
                return { week, rate: evaluated > 0 ? Math.round((done / evaluated) * 100) : null };
            });

            return {
                habit,
                cells,
                rate: totalEvaluated > 0 ? Math.round((totalDone / totalEvaluated) * 100) : null,
                bestStreak,
            };
        });
    }, [habits, weeks, getLogsForHabitInWeek, habitLogs]);

    const thisWeekStats = useMemo(() => getWeekStatsFunc(thisWeek), [getWeekStatsFunc, thisWeek, allHabits, habitLogs]);

    const goalStreak = useMemo(() => {
        let streak = 0;
        for (let i = weeks.length - 1; i >= 0; i--) {
            const stats = getWeekStatsFunc(weeks[i]);
            if (stats.evaluated === 0) continue;
            if (stats.percentage >= globalHabitGoal) streak++;
            else break;
        }
        return streak;
    }, [weeks, getWeekStatsFunc, globalHabitGoal, allHabits, habitLogs]);

    // Per-objective rollup over the last 4 weeks. A habit counts toward EACH of
    // its objectives — independent questions one habit can legitimately feed.
    const objectiveRollup = useMemo(() => {
        const recent = weeks.slice(-4);
        const byObjective = new Map<string, { done: number; evaluated: number }>();

        for (const { habit } of habitStats) {
            for (const objId of habit.objectiveIds ?? []) {
                if (!objectiveById.has(objId)) continue;
                const acc = byObjective.get(objId) ?? { done: 0, evaluated: 0 };
                for (const week of recent) {
                    const logs = getLogsForHabitInWeek(habit.id, week);
                    acc.done += logs.filter((l) => l.status === 'done').length;
                    acc.evaluated += logs.filter((l) => l.status !== 'pending').length;
                }
                byObjective.set(objId, acc);
            }
        }

        return [...byObjective.entries()]
            .map(([id, { done, evaluated }]) => ({
                objective: objectiveById.get(id)!,
                rate: evaluated > 0 ? Math.round((done / evaluated) * 100) : null,
            }))
            .filter((r) => r.rate !== null)
            .sort((a, b) => a.objective.order - b.objective.order);
    }, [habitStats, weeks, getLogsForHabitInWeek, objectiveById, habitLogs]);

    const weekStats = useMemo(
        () => weeks.map((w) => ({ week: w, ...getWeekStatsFunc(w) })),
        [weeks, getWeekStatsFunc, allHabits, habitLogs]
    );

    // Color for a success rate against the goal.
    const rateColor = (rate: number | null) =>
        rate === null ? 'grey'
            : rate >= globalHabitGoal ? 'green'
                : rate >= globalHabitGoal / 2 ? 'amber' : 'orange';
    const cellBg: Record<string, string> = {
        grey: 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600',
        green: 'bg-success-500/15 text-success-600 dark:text-success-400',
        amber: 'bg-amber-400/20 text-amber-600 dark:text-amber-400',
        orange: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
    };
    const barBg: Record<string, string> = {
        grey: 'bg-slate-300 dark:bg-slate-700',
        green: 'bg-success-500',
        amber: 'bg-amber-400',
        orange: 'bg-orange-400',
    };

    if (habits.length === 0) {
        return (
            <div className="p-6 max-w-3xl mx-auto text-center py-16 text-slate-500 dark:text-slate-400">
                No habits yet — add some and the analytics will build themselves.
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-3xl mx-auto pb-28">
            {/* ── Weekly Trend (top, the hero) ───────────────────────────── */}
            <div className="mb-8">
                <div className="flex items-baseline justify-between mb-3 px-1">
                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Weekly trend</h3>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">success rate · goal {globalHabitGoal}%</span>
                </div>
                <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 px-3 pt-6 pb-6">
                    {/* Goal line + gridline, positioned within the 8rem plot area */}
                    <div className="relative h-32">
                        <div
                            className="absolute left-0 right-0 border-t border-dashed border-primary-500/50"
                            style={{ bottom: `${globalHabitGoal}%` }}
                        >
                            <span className="absolute -top-2 -left-1 text-[9px] font-medium text-primary-500 bg-white dark:bg-slate-900 px-1">{globalHabitGoal}%</span>
                        </div>
                        <div className="absolute left-0 right-0 border-t border-slate-200/70 dark:border-slate-800" style={{ bottom: '50%' }} />

                        <div className="absolute inset-0 flex items-end gap-1.5">
                            {weekStats.map((stat, idx) => {
                                const hasData = stat.evaluated > 0;
                                const color = rateColor(hasData ? stat.percentage : null);
                                const isCurrent = idx === weekStats.length - 1;
                                return (
                                    <div key={stat.week} className="flex-1 flex flex-col items-center justify-end h-full">
                                        {hasData && (
                                            <span className={`text-[10px] font-bold tabular-nums mb-0.5 ${color === 'green' ? 'text-success-600 dark:text-success-400' : 'text-orange-500'}`}>
                                                {stat.percentage}
                                            </span>
                                        )}
                                        <div
                                            className={`w-full rounded-t ${barBg[color]} ${isCurrent ? 'ring-2 ring-offset-1 ring-primary-400 dark:ring-offset-slate-900' : ''}`}
                                            style={{ height: `${hasData ? Math.max(stat.percentage, 2) : 2}%` }}
                                            title={`Week ${stat.week}: ${hasData ? `${stat.percentage}% (${stat.done}✓ / ${stat.failed}✗)` : 'no data'}`}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {/* Week labels */}
                    <div className="flex gap-1.5 mt-1.5">
                        {weekStats.map((stat) => (
                            <div key={stat.week} className="flex-1 text-center text-[9px] text-slate-400 dark:text-slate-500">
                                {stat.week.split('-W')[1]}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Compact stat line ──────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-8 px-1">
                <Stat label="This week" value={thisWeekStats.evaluated > 0 ? `${thisWeekStats.percentage}%` : '—'} good={thisWeekStats.percentage >= globalHabitGoal && thisWeekStats.evaluated > 0} />
                <Stat label={`streak ≥ ${globalHabitGoal}%`} value={`${goalStreak}w`} />
                <Stat label="active habits" value={`${habits.length}`} />
                {objectiveRollup.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {objectiveRollup.map(({ objective, rate }) => (
                            <span
                                key={objective.id}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                title={`${objective.title}: ${rate}% over the last 4 weeks`}
                            >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: objective.color }} />
                                {objective.title}
                                <span className="tabular-nums font-semibold">{rate}%</span>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Per-habit rows: my day, scored ─────────────────────────── */}
            <div>
                <div className="flex items-baseline justify-between mb-2 px-1">
                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Habits · last 12 weeks</h3>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">old → new</span>
                </div>
                <div className="divide-y divide-slate-200/70 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 overflow-hidden">
                    {habitStats.map(({ habit, cells, rate }) => {
                        const objs = habitObjectives(habit);
                        return (
                            <div key={habit.id} className="relative flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                                <ObjectiveEdge objectives={objs} />
                                <div className="basis-full sm:basis-48 sm:flex-shrink-0 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{habit.title}</span>
                                        <HabitDetailButton habit={habit} objectives={objs} />
                                    </div>
                                    <div className="text-[11px] text-slate-400 dark:text-slate-500">{habit.type === 'do' ? '✓ do' : '✗ avoid'}</div>
                                </div>

                                {/* 12-week grid, each cell showing the week's % */}
                                <div className="flex items-center gap-1 flex-1 flex-wrap">
                                    {cells.map(({ week, rate: r }) => (
                                        <span
                                            key={week}
                                            className={`w-7 h-5 rounded flex items-center justify-center text-[9px] font-semibold tabular-nums ${cellBg[rateColor(r)]}`}
                                            title={`${week}: ${r === null ? 'no data' : `${r}%`}`}
                                        >
                                            {r === null ? '·' : r}
                                        </span>
                                    ))}
                                </div>

                                <div className={`w-11 text-right text-sm font-bold tabular-nums flex-shrink-0 ${rate === null
                                    ? 'text-slate-300 dark:text-slate-600'
                                    : rate >= globalHabitGoal ? 'text-success-500' : 'text-orange-500'
                                    }`}>
                                    {rate === null ? '—' : `${rate}%`}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value, good }: { label: string; value: string; good?: boolean }) {
    return (
        <div>
            <div className={`text-xl font-display font-bold tabular-nums ${good ? 'text-success-500' : 'text-slate-900 dark:text-slate-100'}`}>{value}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
        </div>
    );
}
