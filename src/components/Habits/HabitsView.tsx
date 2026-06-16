import React from 'react';
import { HabitGridView } from './HabitGridView';
import { HabitChecklistView } from './HabitChecklistView';
import { HabitAnalyticsView } from './HabitAnalyticsView';
import { HabitForm } from './HabitForm';
import { useHabitStore } from '../../store/useHabitStore';
import { useUIStore } from '../../store/useUIStore';
import { useIsMobile } from '../../hooks/useIsMobile';
import { getISOWeek } from '../../utils/habitDates';

export function HabitsView() {
  const isMobile = useIsMobile();
  const habitView = useUIStore((state) => state.habitView);
  const habitForm = useUIStore((state) => state.habitForm);
  const openNewHabit = useUIStore((state) => state.openNewHabit);
  const openEditHabit = useUIStore((state) => state.openEditHabit);
  const closeHabitForm = useUIStore((state) => state.closeHabitForm);

  const habits = useHabitStore((state) => state.habits);
  const addHabit = useHabitStore((state) => state.addHabit);
  const updateHabit = useHabitStore((state) => state.updateHabit);
  const removeHabit = useHabitStore((state) => state.removeHabit);

  const editingHabit = habitForm.editingId
    ? habits.find((h) => h.id === habitForm.editingId && !h.archivedAt) || null
    : null;

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
    closeHabitForm();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Content — section tabs (Grid/Checklist/Analytics) live in the TopNav.
          On mobile the wide 7-day grid and analytics don't fit, so we show only
          the day-at-a-time Checklist — the one habit view that's genuinely
          thumb-friendly. Desktop keeps all three. */}
      <div className="flex-1 overflow-auto">
        {isMobile ? (
          <HabitChecklistView onAddHabit={openNewHabit} />
        ) : (
          <>
            {habitView === 'grid' && (
              <HabitGridView
                onAddHabit={openNewHabit}
                onEditHabit={openEditHabit}
                onDeleteHabit={handleDeleteHabit}
              />
            )}
            {habitView === 'checklist' && <HabitChecklistView onAddHabit={openNewHabit} />}
            {habitView === 'analytics' && <HabitAnalyticsView />}
          </>
        )}
      </div>

      {/* Form Modal */}
      {habitForm.open && (
        <HabitForm habit={editingHabit} onSubmit={handleSubmitForm} onClose={closeHabitForm} />
      )}
    </div>
  );
}
