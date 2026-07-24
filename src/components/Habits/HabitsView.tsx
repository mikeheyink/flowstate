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
  const setHabitView = useUIStore((state) => state.setHabitView);
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

  const handleSubmitForm = (data: { title: string; type: 'do' | 'dont-do'; daysOfWeek: number[]; objectiveIds: string[]; why: string }) => {
    if (editingHabit) {
      updateHabit(editingHabit.id, {
        title: data.title,
        type: data.type,
        daysOfWeek: data.daysOfWeek,
        objectiveIds: data.objectiveIds,
        why: data.why,
      });
    } else {
      addHabit(data.title, data.type, data.daysOfWeek, getISOWeek(new Date()), {
        objectiveIds: data.objectiveIds,
        why: data.why,
      });
    }
    closeHabitForm();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Content — section tabs (Grid/Checklist/Analytics) live in the TopNav on
          desktop. On mobile the wide 7-day grid doesn't fit, so the choices are
          Checklist (the thumb-friendly day view) and Analytics (a vertical list
          that works fine on a phone) via a small segmented control. A persisted
          'grid' choice falls back to Checklist on mobile. */}
      <div className="flex-1 overflow-auto">
        {isMobile ? (
          <>
            <div className="flex justify-center pt-2">
              <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/60 rounded-lg">
                {([['checklist', 'Checklist'], ['analytics', 'Analytics']] as const).map(([id, label]) => {
                  const active = id === 'analytics' ? habitView === 'analytics' : habitView !== 'analytics';
                  return (
                    <button
                      key={id}
                      onClick={() => setHabitView(id)}
                      className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${active
                        ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600 dark:text-primary-400'
                        : 'text-slate-500 dark:text-slate-400'
                        }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            {habitView === 'analytics'
              ? <HabitAnalyticsView />
              : <HabitChecklistView onAddHabit={openNewHabit} />}
          </>
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
