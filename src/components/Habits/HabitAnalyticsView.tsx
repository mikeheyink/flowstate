import React, { useMemo } from 'react';
import { useHabitStore } from '../../store/useHabitStore';
import { useUIStore } from '../../store/useUIStore';
import { getISOWeek, shiftWeek } from '../../utils/habitDates';

interface WeekStat {
  week: string;
  percentage: number;
  completed: number;
  total: number;
}

// The last `count` ISO weeks ending with the current one, oldest first.
function getPreviousWeeks(count: number = 12): string[] {
  const thisWeek = getISOWeek(new Date());
  return Array.from({ length: count }, (_, i) => shiftWeek(thisWeek, -(count - 1 - i)));
}

export function HabitAnalyticsView() {
  const getWeekStatsFunc = useHabitStore((state) => state.getWeekStats);
  // Select the stable array reference, then derive — selecting `.filter(...)`
  // returns a fresh array each render and sends zustand into an infinite loop.
  const allHabits = useHabitStore((state) => state.habits);
  const habits = useMemo(() => allHabits.filter((h) => !h.archivedAt), [allHabits]);
  const getLogsForHabitInWeek = useHabitStore((state) => state.getLogsForHabitInWeek);
  // Subscribe to logs so analytics recompute when a day is toggled.
  const habitLogs = useHabitStore((state) => state.habitLogs);
  const globalHabitGoal = useUIStore((state) => state.globalHabitGoal);

  const weeks = useMemo(() => getPreviousWeeks(12), []);
  const weekStats = useMemo<WeekStat[]>(
    () => weeks.map((w) => {
      const s = getWeekStatsFunc(w);
      return { week: w, percentage: s.percentage, completed: s.totalCompleted, total: s.totalApplicableDays };
    }),
    [weeks, getWeekStatsFunc, allHabits, habitLogs]
  );

  // Calculate streaks
  const streaks = useMemo(() => {
    const streaksByHabit: { [habitId: string]: number } = {};

    for (const habit of habits) {
      let currentStreak = 0;
      let maxStreak = 0;

      for (let i = weeks.length - 1; i >= 0; i--) {
        const weekStats = getWeekStatsFunc(weeks[i]);
        const habitLogs = getLogsForHabitInWeek(habit.id, weeks[i]);
        const applicableDays = habitLogs.length;

        if (applicableDays === 0) continue;

        const completed = habitLogs.filter((l) => l.completed).length;
        if (completed === applicableDays) {
          currentStreak++;
          maxStreak = Math.max(maxStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }

      streaksByHabit[habit.id] = maxStreak;
    }

    return streaksByHabit;
  }, [habits, weeks, getLogsForHabitInWeek, getWeekStatsFunc, habitLogs]);

  // Find problem habits (lowest completion rate)
  const problemHabits = useMemo(() => {
    const habitStats: { habit: any; avgCompletion: number }[] = [];

    for (const habit of habits) {
      let totalCompleted = 0;
      let totalApplicable = 0;

      for (const week of weeks) {
        const logs = getLogsForHabitInWeek(habit.id, week);
        const applicable = logs.length;
        const completed = logs.filter((l) => l.completed).length;
        totalApplicable += applicable;
        totalCompleted += completed;
      }

      const avgCompletion = totalApplicable > 0 ? (totalCompleted / totalApplicable) * 100 : 0;
      habitStats.push({ habit, avgCompletion });
    }

    return habitStats.sort((a, b) => a.avgCompletion - b.avgCompletion).slice(0, 5);
  }, [habits, weeks, getLogsForHabitInWeek, habitLogs]);

  const currentStreak = useMemo(() => {
    let streak = 0;
    for (let i = weeks.length - 1; i >= 0; i--) {
      const stats = getWeekStatsFunc(weeks[i]);
      if (stats.percentage >= globalHabitGoal) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }, [weeks, getWeekStatsFunc, globalHabitGoal, allHabits, habitLogs]);

  const overallCompletion = useMemo(() => {
    const totalStats = weekStats.reduce(
      (acc, s) => ({
        completed: acc.completed + s.completed,
        total: acc.total + s.total,
      }),
      { completed: 0, total: 0 }
    );
    return totalStats.total > 0 ? Math.round((totalStats.completed / totalStats.total) * 100) : 0;
  }, [weekStats]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Habit Analytics</h2>

      {/* Overall Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-50 dark:bg-blue-500/10 p-4 rounded-lg">
          <div className="text-sm text-blue-700 dark:text-blue-300 mb-1">Overall Completion</div>
          <div className="text-3xl font-bold text-blue-900 dark:text-blue-200">{overallCompletion}%</div>
        </div>
        <div className="bg-green-50 dark:bg-green-500/10 p-4 rounded-lg">
          <div className="text-sm text-green-700 dark:text-green-300 mb-1">Current Streak</div>
          <div className="text-3xl font-bold text-green-900 dark:text-green-200">{currentStreak}w</div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-500/10 p-4 rounded-lg">
          <div className="text-sm text-purple-700 dark:text-purple-300 mb-1">Active Habits</div>
          <div className="text-3xl font-bold text-purple-900 dark:text-purple-200">{habits.length}</div>
        </div>
      </div>

      {/* Weekly Completion Trend */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">12-Week Trend</h3>
        <div className="flex items-end gap-1 h-32 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
          {weekStats.map((stat, idx) => {
            const goalMet = stat.percentage >= globalHabitGoal;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 justify-end h-full">
                <div
                  className={`w-full rounded-t transition-colors ${
                    goalMet ? 'bg-green-500' : 'bg-orange-500'
                  }`}
                  style={{ height: `${Math.max(stat.percentage, 2)}%` }}
                  title={`Week ${stat.week}: ${stat.percentage}%`}
                />
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">{stat.week.split('-W')[1]}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Problem Habits */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Habits You're Struggling With</h3>
        {problemHabits.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">All habits are going great!</div>
        ) : (
          <div className="space-y-3">
            {problemHabits.map(({ habit, avgCompletion }) => (
              <div key={habit.id} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-semibold">{habit.title}</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">{habit.type === 'do' ? '✓ Do' : '✗ Avoid'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{Math.round(avgCompletion)}%</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">completion</div>
                  </div>
                </div>
                <div className="w-full bg-slate-300 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all"
                    style={{ width: `${avgCompletion}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Habit Streaks */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Perfect Week Streaks</h3>
        {habits.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">No habits yet.</div>
        ) : (
          <div className="space-y-2">
            {habits.map((habit) => (
              <div key={habit.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="font-medium">{habit.title}</div>
                <div className="text-lg font-bold text-green-600 dark:text-green-400">{streaks[habit.id] || 0}w</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
