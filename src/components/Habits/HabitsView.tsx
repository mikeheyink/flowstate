import React, { useState } from 'react';
import { HabitGridView } from './HabitGridView';
import { HabitChecklistView } from './HabitChecklistView';
import { HabitAnalyticsView } from './HabitAnalyticsView';
import { HabitForm } from './HabitForm';
import { useHabitStore } from '../../store/useHabitStore';
import { useUIStore } from '../../store/useUIStore';

export function HabitsView() {
  const [showForm, setShowForm] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);

  const habitView = useUIStore((state) => state.habitView);
  const setHabitView = useUIStore((state) => state.setHabitView);

  const habits = useHabitStore((state) => state.habits);
  const addHabit = useHabitStore((state) => state.addHabit);
  const updateHabit = useHabitStore((state) => state.updateHabit);
  const removeHabit = useHabitStore((state) => state.removeHabit);

  const editingHabit = editingHabitId ? habits.find((h) => h.id === editingHabitId && !h.archivedAt) : null;

  function getISOWeek(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }

  const handleAddHabit = () => {
    setEditingHabitId(null);
    setShowForm(true);
  };

  const handleEditHabit = (habitId: string) => {
    setEditingHabitId(habitId);
    setShowForm(true);
  };

  const handleDeleteHabit = (habitId: string) => {
    if (confirm('Are you sure? This will remove the habit from this week forward.')) {
      removeHabit(habitId);
    }
  };

  const handleSubmitForm = (data: { title: string; type: 'do' | 'dont-do'; daysOfWeek: number[] }) => {
    if (editingHabit) {
      updateHabit(editingHabit.id, {
        title: data.title,
        type: data.type,
        daysOfWeek: data.daysOfWeek,
      });
    } else {
      addHabit(data.title, data.type, data.daysOfWeek, getISOWeek(new Date()));
    }
    setShowForm(false);
    setEditingHabitId(null);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingHabitId(null);
  };

  return (
    <div className="h-full flex flex-col">
      {/* View Tabs */}
      <div className="flex gap-1 px-6 pt-6 border-b">
        <button
          onClick={() => setHabitView('grid')}
          className={`px-4 py-3 font-medium transition-colors border-b-2 ${
            habitView === 'grid'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Grid
        </button>
        <button
          onClick={() => setHabitView('checklist')}
          className={`px-4 py-3 font-medium transition-colors border-b-2 ${
            habitView === 'checklist'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Checklist
        </button>
        <button
          onClick={() => setHabitView('analytics')}
          className={`px-4 py-3 font-medium transition-colors border-b-2 ${
            habitView === 'analytics'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Analytics
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {habitView === 'grid' && (
          <HabitGridView
            onAddHabit={handleAddHabit}
            onEditHabit={handleEditHabit}
            onDeleteHabit={handleDeleteHabit}
          />
        )}
        {habitView === 'checklist' && <HabitChecklistView onAddHabit={handleAddHabit} />}
        {habitView === 'analytics' && <HabitAnalyticsView />}
      </div>

      {/* Form Modal */}
      {showForm && (
        <HabitForm habit={editingHabit} onSubmit={handleSubmitForm} onClose={handleCloseForm} />
      )}
    </div>
  );
}
