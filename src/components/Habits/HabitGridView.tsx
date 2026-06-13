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
  // Subscribe to the raw data so the grid re-renders (and the memos recompute)
  // whenever a habit is added/edited or a day is toggled.
  const allHabits = useHabitStore((state) => state.habits);
  const habitLogs = useHabitStore((state) => state.habitLogs);
  const globalHabitGoal = useUIStore((state) => state.globalHabitGoal);

  const habits = useMemo(() => getHabitsForWeek(currentWeek), [currentWeek, allHabits]);
  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek]);
  const stats = useMemo(() => getWeekStats(currentWeek), [currentWeek, allHabits, habitLogs]);

  const goalMet = stats.percentage >= globalHabitGoal;

  const [focusedHabitIdx, setFocusedHabitIdx] = useState(0);
  const [focusedDayIdx, setFocusedDayIdx] = useState(0);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      const key = e.key.toLowerCase();

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
  }, [focusedHabitIdx, focusedDayIdx, habits, weekDates, currentWeek, onAddHabit, onEditHabit, onDeleteHabit]);

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
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          title="Add Habit (A)"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={handlePrevWeek}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          title="Previous week (,)"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-lg font-semibold">
          Week {currentWeek.split('-W')[1]} · {weekDates[0].toLocaleDateString()} – {weekDates[6].toLocaleDateString()}
        </div>
        <button
          onClick={handleNextWeek}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          title="Next week (.)"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6 p-4 bg-slate-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-600">This week</div>
            <div className="text-2xl font-bold">
              {stats.totalCompleted} / {stats.totalApplicableDays}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-600">Completion</div>
            <div className={`text-3xl font-bold ${goalMet ? 'text-green-600' : 'text-orange-600'}`}>
              {stats.percentage}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-600">Goal</div>
            <div className="text-2xl font-semibold">{globalHabitGoal}%</div>
          </div>
        </div>
        {goalMet && (
          <div className="mt-3 text-sm text-green-700 bg-green-50 px-3 py-2 rounded inline-block">
            ✓ Goal met this week!
          </div>
        )}
      </div>

      {/* Grid */}
      {habits.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          No habits for this week. Add one to get started!
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-4 font-semibold">Habit</th>
                {DAYS.map((day, i) => (
                  <th key={i} className="text-center py-2 px-2 font-semibold">
                    <div>{day}</div>
                    <div className="text-xs text-slate-500 mt-1">
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
                  <tr key={habit.id} className={`border-b ${habitIdx === focusedHabitIdx ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                    <td className="py-3 px-4">
                      <div className="font-medium">{habit.title}</div>
                      <div className="text-xs text-slate-500">{habit.type === 'do' ? '✓ Do' : '✗ Avoid'}</div>
                    </td>
                    {DAY_INDICES.map((dayIdx) => {
                      const dateStr = toLocalISO(weekDates[dayIdx]);
                      const applicable = habit.daysOfWeek.includes(dayIdx);
                      const log = logs.find((l) => l.date === dateStr);

                      if (!applicable) {
                        return (
                          <td key={dayIdx} className="text-center py-3 px-2">
                            <div className="text-slate-300">-</div>
                          </td>
                        );
                      }

                      const isCompleted = log?.completed;

                      const isFocused = habitIdx === focusedHabitIdx && dayIdx === focusedDayIdx;
                      return (
                        <td key={dayIdx} className={`text-center py-3 px-2 ${isFocused ? 'ring-2 ring-inset ring-blue-400' : ''}`}>
                          <button
                            onClick={() => handleToggleHabit(habit.id, dateStr)}
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                              isCompleted
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            } ${isFocused ? 'ring-2 ring-blue-400 font-bold' : ''}`}
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
                          className="p-1 hover:bg-slate-200 rounded transition-colors"
                          title="Edit Habit (E)"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteHabit?.(habit.id)}
                          className="p-1 hover:bg-red-100 hover:text-red-600 rounded transition-colors"
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
