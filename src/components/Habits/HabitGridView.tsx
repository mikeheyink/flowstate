import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Edit2, Trash2 } from 'lucide-react';
import { useHabitStore } from '../../store/useHabitStore';
import { useUIStore } from '../../store/useUIStore';
import { getISOWeek, getWeekDates, shiftWeek, toLocalISO } from '../../utils/habitDates';

interface HabitGridViewProps {
  onAddHabit?: () => void;
  onEditHabit?: (habitId: string) => void;
  onDeleteHabit?: (habitId: string) => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_INDICES = [0, 1, 2, 3, 4, 5, 6]; // 0=Monday, 6=Sunday

export function HabitGridView({ onAddHabit, onEditHabit, onDeleteHabit }: HabitGridViewProps) {
  const [currentWeek, setCurrentWeek] = useState(() => getISOWeek(new Date()));

  const getHabitsForWeek = useHabitStore((state) => state.getHabitsForWeek);
  const getLogsForHabitInWeek = useHabitStore((state) => state.getLogsForHabitInWeek);
  const logHabit = useHabitStore((state) => state.logHabit);
  const getWeekStats = useHabitStore((state) => state.getWeekStats);
  const moveHabit = useHabitStore((state) => state.moveHabit);
  // Subscribe to the raw data so the grid re-renders (and the memos recompute)
  // whenever a habit is added/edited, reordered, or a day is toggled.
  const allHabits = useHabitStore((state) => state.habits);
  const habitLogs = useHabitStore((state) => state.habitLogs);
  const globalHabitGoal = useUIStore((state) => state.globalHabitGoal);

  const habits = useMemo(() => getHabitsForWeek(currentWeek), [currentWeek, allHabits]);
  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek]);
  const stats = useMemo(() => getWeekStats(currentWeek), [currentWeek, allHabits, habitLogs]);

  const goalMet = stats.percentage >= globalHabitGoal;

  const [focusedHabitIdx, setFocusedHabitIdx] = useState(0);
  const [focusedDayIdx, setFocusedDayIdx] = useState(0);

  // Keep the focused row valid as habits are added/removed (e.g. after delete,
  // the index could point past the end). Clamp to the last row, never below 0.
  useEffect(() => {
    setFocusedHabitIdx((prev) => Math.max(0, Math.min(prev, habits.length - 1)));
  }, [habits.length]);

  // Scroll the focused row into view so keyboard navigation never goes off-screen.
  useEffect(() => {
    const row = document.querySelector(`[data-habit-row="${focusedHabitIdx}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [focusedHabitIdx]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore typing in inputs, and stand down while any modal/overlay is open
      // (so arrows/space don't move the grid behind the habit form or palette).
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      if (useUIStore.getState().isAnyOverlayOpen()) return;

      const key = e.key.toLowerCase();
      const isCmd = e.metaKey || e.ctrlKey;

      // ⌘↑ / ⌘↓ — reorder the focused habit (persists across grid & checklist).
      if (isCmd && (key === 'arrowup' || key === 'arrowdown')) {
        e.preventDefault();
        const habit = habits[focusedHabitIdx];
        if (habit) {
          const dir = key === 'arrowup' ? 'up' : 'down';
          moveHabit(habit.id, dir);
          // Keep focus on the moved habit as it changes position.
          setFocusedHabitIdx((prev) =>
            dir === 'up' ? Math.max(prev - 1, 0) : Math.min(prev + 1, habits.length - 1)
          );
        }
        return;
      }

      if (key === 'arrowdown') {
        e.preventDefault();
        setFocusedHabitIdx((prev) => Math.min(prev + 1, habits.length - 1));
      } else if (key === 'arrowup') {
        e.preventDefault();
        setFocusedHabitIdx((prev) => Math.max(prev - 1, 0));
      } else if (key === 'arrowright') {
        e.preventDefault();
        setFocusedDayIdx((prev) => Math.min(prev + 1, 6));
      } else if (key === 'arrowleft') {
        e.preventDefault();
        setFocusedDayIdx((prev) => Math.max(prev - 1, 0));
      } else if (key === ' ' || key === 'x') {
        e.preventDefault();
        if (habits[focusedHabitIdx]) {
          const dateStr = toLocalISO(weekDates[focusedDayIdx]);
          const habit = habits[focusedHabitIdx];
          if (habit.daysOfWeek.includes(focusedDayIdx)) {
            handleToggleHabit(habit.id, dateStr);
          }
        }
      } else if (key === 'a') {
        e.preventDefault();
        onAddHabit?.();
      } else if (key === 'e') {
        e.preventDefault();
        if (habits[focusedHabitIdx]) {
          onEditHabit?.(habits[focusedHabitIdx].id);
        }
      } else if (key === 'delete' || key === 'backspace') {
        e.preventDefault();
        if (habits[focusedHabitIdx]) {
          onDeleteHabit?.(habits[focusedHabitIdx].id);
        }
      } else if (key === '.') {
        // Next week. ([ / ] are reserved for cycling habit views.)
        e.preventDefault();
        handleNextWeek();
      } else if (key === ',') {
        // Previous week.
        e.preventDefault();
        handlePrevWeek();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedHabitIdx, focusedDayIdx, habits, weekDates, currentWeek, onAddHabit, onEditHabit, onDeleteHabit, moveHabit]);

  const handlePrevWeek = () => setCurrentWeek((w) => shiftWeek(w, -1));
  const handleNextWeek = () => setCurrentWeek((w) => shiftWeek(w, 1));

  const handleToggleHabit = (habitId: string, dateStr: string) => {
    const logs = getLogsForHabitInWeek(habitId, currentWeek);
    const log = logs.find((l) => l.date === dateStr);
    const newCompleted = !log?.completed;
    logHabit(habitId, dateStr, newCompleted);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Habits</h2>
        <button
          onClick={onAddHabit}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Add Habit (A)"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={handlePrevWeek}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Previous week (,)"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-lg font-semibold">
          Week {currentWeek.split('-W')[1]} · {weekDates[0].toLocaleDateString()} – {weekDates[6].toLocaleDateString()}
        </div>
        <button
          onClick={handleNextWeek}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Next week (.)"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-600 dark:text-slate-400">This week</div>
            <div className="text-2xl font-bold">
              {stats.totalCompleted} / {stats.totalApplicableDays}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-600 dark:text-slate-400">Completion</div>
            <div className={`text-3xl font-bold ${goalMet ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
              {stats.percentage}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-600 dark:text-slate-400">Goal</div>
            <div className="text-2xl font-semibold">{globalHabitGoal}%</div>
          </div>
        </div>
        {goalMet && (
          <div className="mt-3 text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-500/15 px-3 py-2 rounded inline-block">
            ✓ Goal met this week!
          </div>
        )}
      </div>

      {/* Grid */}
      {habits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-slate-600 dark:text-slate-300 font-medium mb-1">No habits for this week yet</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mb-5">Track something you want to do (or avoid) — daily.</p>
          <button
            onClick={onAddHabit}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-500 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add your first habit
          </button>
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
            or press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono">A</kbd>
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="text-left py-2 px-4 font-semibold">Habit</th>
                {DAYS.map((day, i) => (
                  <th key={i} className="text-center py-2 px-2 font-semibold">
                    <div>{day}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      {weekDates[i].toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                    </div>
                  </th>
                ))}
                <th className="text-center py-2 px-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {habits.map((habit, habitIdx) => {
                const logs = getLogsForHabitInWeek(habit.id, currentWeek);
                const completedCount = logs.filter((l) => l.completed).length;

                return (
                  <tr key={habit.id} data-habit-row={habitIdx} className={`border-b border-slate-200 dark:border-slate-800 ${habitIdx === focusedHabitIdx ? 'bg-primary-50 dark:bg-primary-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                    <td className="py-3 px-4">
                      <div className="font-medium">{habit.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{habit.type === 'do' ? '✓ Do' : '✗ Avoid'}</div>
                    </td>
                    {DAY_INDICES.map((dayIdx) => {
                      const dateStr = toLocalISO(weekDates[dayIdx]);
                      const applicable = habit.daysOfWeek.includes(dayIdx);
                      const log = logs.find((l) => l.date === dateStr);

                      if (!applicable) {
                        return (
                          <td key={dayIdx} className="text-center py-3 px-2">
                            <div className="text-slate-300 dark:text-slate-700">-</div>
                          </td>
                        );
                      }

                      const isCompleted = log?.completed;

                      const isFocused = habitIdx === focusedHabitIdx && dayIdx === focusedDayIdx;
                      return (
                        <td key={dayIdx} className="text-center py-3 px-2">
                          <button
                            onClick={() => handleToggleHabit(habit.id, dateStr)}
                            className={`w-10 h-10 rounded-lg inline-flex items-center justify-center align-middle transition-colors cursor-pointer ${
                              isCompleted
                                ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-500/30'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                            } ${isFocused ? 'ring-2 ring-primary-400 font-bold' : ''}`}
                            title={isCompleted ? 'Mark incomplete' : 'Mark complete (Space)'}
                          >
                            {isCompleted ? '✓' : '○'}
                          </button>
                        </td>
                      );
                    })}
                    <td className="text-center py-3 px-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onEditHabit?.(habit.id)}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                          title="Edit Habit (E)"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteHabit?.(habit.id)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                          title="Delete Habit (Delete)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
