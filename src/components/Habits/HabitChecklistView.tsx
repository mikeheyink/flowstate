import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useHabitStore } from '../../store/useHabitStore';
import { getISOWeek, getWeekDates, toLocalISO } from '../../utils/habitDates';

interface HabitChecklistViewProps {
  onAddHabit?: () => void;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function HabitChecklistView({ onAddHabit }: HabitChecklistViewProps) {
  const [currentWeek, setCurrentWeek] = useState(() => getISOWeek(new Date()));
  const [focusedDayIndex, setFocusedDayIndex] = useState(0); // 0 = Monday of this week

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

  const handlePrevDay = () => {
    if (focusedDayIndex > 0) {
      setFocusedDayIndex(focusedDayIndex - 1);
    }
  };

  const handleNextDay = () => {
    if (focusedDayIndex < 6) {
      setFocusedDayIndex(focusedDayIndex + 1);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Today's Habits</h2>
        <button
          onClick={onAddHabit}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
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
          className="p-2 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          title="Previous Day"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center flex-1">
          <div className="text-xl font-bold">{DAYS[focusedDayIndex]}</div>
          <div className="text-sm text-slate-600">{focusedDate.toLocaleDateString()}</div>
        </div>
        <button
          onClick={handleNextDay}
          disabled={focusedDayIndex === 6}
          className="p-2 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          title="Next Day"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Habits List */}
      <div className="space-y-3">
        {habitsForFocusedDay.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            No habits for {DAYS[focusedDayIndex].toLowerCase()}
          </div>
        ) : (
          habitsForFocusedDay.map(({ habit, completed }) => (
            <button
              key={habit.id}
              onClick={() => handleToggleHabit(habit.id)}
              className={`w-full p-4 rounded-lg text-left transition-colors ${
                completed
                  ? 'bg-green-100 text-green-900 hover:bg-green-200'
                  : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
                  completed ? 'bg-green-600 text-white' : 'bg-slate-300 text-slate-600'
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
      <div className="mt-8 pt-6 border-t">
        <div className="text-xs font-semibold text-slate-600 mb-3">Other days this week</div>
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
                  idx === focusedDayIndex ? 'ring-2 ring-blue-500' : ''
                } ${total === 0 ? 'bg-slate-50 text-slate-400' : 'bg-slate-100 text-slate-700'}`}
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
