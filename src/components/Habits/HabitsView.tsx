import React, { useState, useEffect } from 'react';
import { HabitGridView } from './HabitGridView';
import { HabitChecklistView } from './HabitChecklistView';
import { HabitAnalyticsView } from './HabitAnalyticsView';
import { HabitForm } from './HabitForm';
import { useHabitStore } from '../../store/useHabitStore';
import { useUIStore } from '../../store/useUIStore';
import { getISOWeek } from '../../utils/habitDates';

export function HabitsView() {
  const [showForm, setShowForm] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);

  const habitView = useUIStore((state) => state.habitView);
  const habitFormSignal = useUIStore((state) => state.habitFormSignal);

  const habits = useHabitStore((state) => state.habits);
  const addHabit = useHabitStore((state) => state.addHabit);
  const updateHabit = useHabitStore((state) => state.updateHabit);
  const removeHabit = useHabitStore((state) => state.removeHabit);

  const editingHabit = editingHabitId ? habits.find((h) => h.id === editingHabitId && !h.archivedAt) : null;

  const handleAddHabit = () => {
    setEditingHabitId(null);
    setShowForm(true);
  };

  // The command palette / global hotkeys can request the "new habit" form by
  // bumping habitFormSignal. Ignore the initial 0 so it only fires on a real bump.
  useEffect(() => {
    if (habitFormSignal > 0) {
      setEditingHabitId(null);
      setShowForm(true);
    }
  }, [habitFormSignal]);

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
      {/* Content — section tabs (Grid/Checklist/Analytics) live in the TopNav */}
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
