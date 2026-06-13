import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Edit2, Trash2 } from 'lucide-react';
import { useHabitStore } from '../../store/useHabitStore';
import { useUIStore } from '../../store/useUIStore';

interface HabitGridViewProps {
  onAddHabit?: () => void;
  onEditHabit?: (habitId: string) => void;
  onDeleteHabit?: (habitId: string) => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_INDICES = [0, 1, 2, 3, 4, 5, 6]; // 0=Monday, 6=Sunday

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getWeekDates(weekStr: string): Date[] {
  const year = parseInt(weekStr.substring(0, 4));
  const week = parseInt(weekStr.substring(6, 8));

  const jan4 = new Date(year, 0, 4);
  const weekStart = new Date(jan4);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday of week 1
  const daysOffset = (week - 1) * 7;
  weekStart.setDate(weekStart.getDate() + daysOffset);

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export function HabitGridView({ onAddHabit, onEditHabit, onDeleteHabit }: HabitGridViewProps) {
  const [currentWeek, setCurrentWeek] = useState(() => getISOWeek(new Date()));

  const getHabitsForWeek = useHabitStore((state) => state.getHabitsForWeek);
  const getLogsForHabitInWeek = useHabitStore((state) => state.getLogsForHabitInWeek);
  const logHabit = useHabitStore((state) => state.logHabit);
  const getWeekStats = useHabitStore((state) => state.getWeekStats);
  const globalHabitGoal = useUIStore((state) => state.globalHabitGoal);

  const habits = useMemo(() => getHabitsForWeek(currentWeek), [currentWeek]);
  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek]);
  const stats = useMemo(() => getWeekStats(currentWeek), [currentWeek]);

  const goalMet = stats.percentage >= globalHabitGoal;

  const handlePrevWeek = () => {
    const [year, weekNum] = currentWeek.split('-W').map(Number);
    let newWeek = weekNum - 1;
    let newYear = year;
    if (newWeek < 1) {
      newYear--;
      newWeek = 52; // Rough approximation; could be 53 in some years
    }
    setCurrentWeek(`${newYear}-W${String(newWeek).padStart(2, '0')}`);
  };

  const handleNextWeek = () => {
    const [year, weekNum] = currentWeek.split('-W').map(Number);
    let newWeek = weekNum + 1;
    let newYear = year;
    if (newWeek > 52) {
      newYear++;
      newWeek = 1;
    }
    setCurrentWeek(`${newYear}-W${String(newWeek).padStart(2, '0')}`);
  };

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
          title="Previous Week ([)"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-lg font-semibold">
          Week {currentWeek.split('-W')[1]} · {weekDates[0].toLocaleDateString()} – {weekDates[6].toLocaleDateString()}
        </div>
        <button
          onClick={handleNextWeek}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          title="Next Week (])"
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
              {habits.map((habit) => {
                const logs = getLogsForHabitInWeek(habit.id, currentWeek);
                const completedCount = logs.filter((l) => l.completed).length;

                return (
                  <tr key={habit.id} className="border-b hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-medium">{habit.title}</div>
                      <div className="text-xs text-slate-500">{habit.type === 'do' ? '✓ Do' : '✗ Avoid'}</div>
                    </td>
                    {DAY_INDICES.map((dayIdx) => {
                      const dateStr = weekDates[dayIdx].toISOString().split('T')[0];
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

                      return (
                        <td key={dayIdx} className="text-center py-3 px-2">
                          <button
                            onClick={() => handleToggleHabit(habit.id, dateStr)}
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                              isCompleted
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            }`}
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
