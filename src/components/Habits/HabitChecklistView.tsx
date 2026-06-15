import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useHabitStore } from '../../store/useHabitStore';
import { useUIStore } from '../../store/useUIStore';
import { getISOWeek, getWeekDates, toLocalISO } from '../../utils/habitDates';

interface HabitChecklistViewProps {
  onAddHabit?: () => void;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const todayDayIndex = () => (new Date().getDay() + 6) % 7; // 0 = Monday

export function HabitChecklistView({ onAddHabit }: HabitChecklistViewProps) {
  const [currentWeek, setCurrentWeek] = useState(() => getISOWeek(new Date()));
  // Start on the actual current day, not Monday — this is the "today" view.
  const [focusedDayIndex, setFocusedDayIndex] = useState(todayDayIndex);
  const [focusedHabitIdx, setFocusedHabitIdx] = useState(0);

  const getHabitsForWeek = useHabitStore((state) => state.getHabitsForWeek);
  const getLogsForHabitInWeek = useHabitStore((state) => state.getLogsForHabitInWeek);
  const logHabit = useHabitStore((state) => state.logHabit);
  // Subscribe to raw data so the list reflects adds/edits/toggles immediately.
  const allHabits = useHabitStore((state) => state.habits);
  const habitLogs = useHabitStore((state) => state.habitLogs);

  const habits = useMemo(() => getHabitsForWeek(currentWeek), [currentWeek, allHabits]);
  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek]);
  const focusedDate = weekDates[focusedDayIndex];
  const focusedDateStr = toLocalISO(focusedDate);

  const habitsForFocusedDay = useMemo(() => {
    return habits
      .filter((h) => h.daysOfWeek.includes(focusedDayIndex))
      .map((habit) => {
        const logs = getLogsForHabitInWeek(habit.id, currentWeek);
        const log = logs.find((l) => l.date === focusedDateStr);
        return { habit, completed: log?.completed || false };
      });
  }, [habits, focusedDayIndex, focusedDateStr, currentWeek, habitLogs]);

  const handleToggleHabit = (habitId: string) => {
    const logs = getLogsForHabitInWeek(habitId, currentWeek);
    const log = logs.find((l) => l.date === focusedDateStr);
    const newCompleted = !log?.completed;
    logHabit(habitId, focusedDateStr, newCompleted);
  };

  const handlePrevDay = () => setFocusedDayIndex((d) => Math.max(0, d - 1));
  const handleNextDay = () => setFocusedDayIndex((d) => Math.min(6, d + 1));

  // Keep the focused habit in range as the day's list changes.
  useEffect(() => {
    setFocusedHabitIdx((prev) => Math.max(0, Math.min(prev, habitsForFocusedDay.length - 1)));
  }, [habitsForFocusedDay.length]);

  // Keyboard: ←/→ change day, ↑/↓ move between habits, Space/X toggle, A add.
  // (Same verbs as the grid, so muscle memory carries across the two views.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (useUIStore.getState().isAnyOverlayOpen()) return;

      const key = e.key.toLowerCase();
      if (key === 'arrowleft') { e.preventDefault(); handlePrevDay(); }
      else if (key === 'arrowright') { e.preventDefault(); handleNextDay(); }
      else if (key === 'arrowdown') { e.preventDefault(); setFocusedHabitIdx((p) => Math.min(p + 1, habitsForFocusedDay.length - 1)); }
      else if (key === 'arrowup') { e.preventDefault(); setFocusedHabitIdx((p) => Math.max(p - 1, 0)); }
      else if (key === ' ' || key === 'x') {
        e.preventDefault();
        const entry = habitsForFocusedDay[focusedHabitIdx];
        if (entry) handleToggleHabit(entry.habit.id);
      } else if (key === 'a') { e.preventDefault(); onAddHabit?.(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [habitsForFocusedDay, focusedHabitIdx, onAddHabit]);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Checklist</h2>
        <button
          onClick={onAddHabit}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          title="Add Habit (A)"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Day Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={handlePrevDay}
          disabled={focusedDayIndex === 0}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          title="Previous day (←)"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center flex-1">
          <div className="text-xl font-bold">
            {DAYS[focusedDayIndex]}
            {focusedDayIndex === todayDayIndex() && currentWeek === getISOWeek(new Date()) && (
              <span className="ml-2 text-xs font-semibold text-primary-600 dark:text-primary-400 align-middle">Today</span>
            )}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400">{focusedDate.toLocaleDateString()}</div>
        </div>
        <button
          onClick={handleNextDay}
          disabled={focusedDayIndex === 6}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          title="Next day (→)"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Habits List */}
      <div className="space-y-3">
        {habitsForFocusedDay.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            No habits for {DAYS[focusedDayIndex].toLowerCase()}.
            <button onClick={onAddHabit} className="ml-1 text-primary-600 dark:text-primary-400 hover:underline">Add one</button>
          </div>
        ) : (
          habitsForFocusedDay.map(({ habit, completed }, idx) => (
            <button
              key={habit.id}
              onClick={() => { setFocusedHabitIdx(idx); handleToggleHabit(habit.id); }}
              className={`w-full p-4 rounded-lg text-left transition-colors ${
                completed
                  ? 'bg-green-100 dark:bg-green-500/20 text-green-900 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
              } ${idx === focusedHabitIdx ? 'ring-2 ring-primary-400' : ''}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
                  completed ? 'bg-green-600 text-white' : 'bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                }`}>
                  {completed ? '✓' : '○'}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{habit.title}</div>
                  <div className="text-sm opacity-75">{habit.type === 'do' ? '✓ Do' : '✗ Avoid'}</div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Mini preview of other days */}
      <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3">Other days this week</div>
        <div className="grid grid-cols-7 gap-2">
          {DAYS.map((day, idx) => {
            const dayHabits = habits.filter((h) => h.daysOfWeek.includes(idx));
            const logs = dayHabits.flatMap((h) => {
              const hLogs = getLogsForHabitInWeek(h.id, currentWeek);
              return hLogs.filter((l) => l.date === toLocalISO(weekDates[idx]));
            });
            const completed = logs.filter((l) => l.completed).length;
            const total = dayHabits.length;

            return (
              <div
                key={idx}
                className={`p-2 text-center rounded-lg text-xs font-medium ${
                  idx === focusedDayIndex ? 'ring-2 ring-primary-500' : ''
                } ${total === 0 ? 'bg-slate-50 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
              >
                <div>{day.substring(0, 3)}</div>
                <div className="text-xs mt-1">
                  {completed}/{total}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
