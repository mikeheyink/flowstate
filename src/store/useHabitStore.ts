import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Habit, HabitLog } from '../types';
import { supabase } from '../utils/supabase';

const generateId = () => Math.random().toString(36).substring(2, 9);

interface PendingOperation {
  id: string;
  type: 'insert' | 'update' | 'delete';
  table: string;
  data?: any;
  habitId?: string;
}

interface HabitState {
  habits: Habit[];
  habitLogs: HabitLog[];
  isLoading: boolean;
  error: string | null;
  guestMode: boolean;

  // Offline sync
  pendingOperations: PendingOperation[];

  // Actions
  fetchHabits: () => Promise<void>;
  addHabit: (title: string, type: 'do' | 'dont-do', daysOfWeek: number[], appliesFromWeek: string) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  removeHabit: (id: string) => void; // soft-delete
  logHabit: (habitId: string, date: string, completed: boolean) => void;

  // Queries
  getHabitsForWeek: (weekStr: string) => Habit[];
  getLogsForWeek: (weekStr: string) => HabitLog[];
  getLogsForHabitInWeek: (habitId: string, weekStr: string) => HabitLog[];

  // Stats
  getWeekStats: (weekStr: string) => {
    totalApplicableDays: number;
    totalCompleted: number;
    percentage: number;
  };

  setGuestMode: (isGuest: boolean) => void;
  setError: (error: string | null) => void;
  processPendingOperations: () => Promise<void>;
}

const mapFromDb = (dbHabit: any): Habit => ({
  id: dbHabit.id,
  title: dbHabit.title,
  type: dbHabit.type as 'do' | 'dont-do',
  createdAt: parseInt(dbHabit.created_at),
  archivedAt: dbHabit.archived_at ? parseInt(dbHabit.archived_at) : null,
  appliesFromWeek: dbHabit.applies_from_week,
  appliesUntilWeek: dbHabit.applies_until_week,
  daysOfWeek: dbHabit.days_of_week || [],
});

const mapToDb = (habit: Partial<Habit>) => {
  const dbObj: any = {};
  if (habit.id !== undefined) dbObj.id = habit.id;
  if (habit.title !== undefined) dbObj.title = habit.title;
  if (habit.type !== undefined) dbObj.type = habit.type;
  if (habit.createdAt !== undefined) dbObj.created_at = habit.createdAt;
  if (habit.archivedAt !== undefined) dbObj.archived_at = habit.archivedAt;
  if (habit.appliesFromWeek !== undefined) dbObj.applies_from_week = habit.appliesFromWeek;
  if (habit.appliesUntilWeek !== undefined) dbObj.applies_until_week = habit.appliesUntilWeek;
  if (habit.daysOfWeek !== undefined) dbObj.days_of_week = habit.daysOfWeek;
  return dbObj;
};

const queueOperation = async (
  set: any,
  get: any,
  operation: Omit<PendingOperation, 'id'>,
  executeOnline: () => Promise<any>
) => {
  const state = get();
  if (state.guestMode) return;

  if (!navigator.onLine) {
    const op: PendingOperation = { ...operation, id: generateId() };
    set({ pendingOperations: [...state.pendingOperations, op] });
    return;
  }

  try {
    await executeOnline();
  } catch (err) {
    const op: PendingOperation = { ...operation, id: generateId() };
    set({ pendingOperations: [...state.pendingOperations, op] });
  }
};

export const useHabitStore = create<HabitState>()(
  persist(
    (set, get) => ({
      habits: [],
      habitLogs: [],
      isLoading: false,
      error: null,
      guestMode: true,
      pendingOperations: [],

      fetchHabits: async () => {
        set({ isLoading: true });
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            set({ habits: [], habitLogs: [], error: null, isLoading: false });
            return;
          }

          const { data: habitsData, error: habitsError } = await supabase
            .from('habits')
            .select('*')
            .eq('user_id', user.id)
            .is('archived_at', null);

          const { data: logsData, error: logsError } = await supabase
            .from('habit_logs')
            .select('*')
            .eq('user_id', user.id);

          if (habitsError) throw habitsError;
          if (logsError) throw logsError;

          set({
            habits: habitsData?.map(mapFromDb) || [],
            habitLogs: logsData || [],
            error: null,
          });
        } catch (err: any) {
          set({ error: err.message });
        } finally {
          set({ isLoading: false });
        }
      },

      addHabit: (title, type, daysOfWeek, appliesFromWeek) => {
        const habit: Habit = {
          id: generateId(),
          title,
          type,
          createdAt: Date.now(),
          archivedAt: null,
          appliesFromWeek,
          appliesUntilWeek: null,
          daysOfWeek,
        };

        set((state) => ({ habits: [...state.habits, habit] }));

        queueOperation(set, get, {
          type: 'insert',
          table: 'habits',
          data: mapToDb(habit),
        }, async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          await supabase.from('habits').insert([{ ...mapToDb(habit), user_id: user.id }]);
        });
      },

      updateHabit: (id, updates) => {
        set((state) => ({
          habits: state.habits.map((h) => (h.id === id ? { ...h, ...updates } : h)),
        }));

        queueOperation(set, get, {
          type: 'update',
          table: 'habits',
          habitId: id,
          data: mapToDb(updates),
        }, async () => {
          await supabase.from('habits').update(mapToDb(updates)).eq('id', id);
        });
      },

      removeHabit: (id) => {
        // Soft delete
        get().updateHabit(id, { archivedAt: Date.now() });
      },

      logHabit: (habitId, date, completed) => {
        const log: HabitLog = {
          id: generateId(),
          habitId,
          date,
          completed,
          updatedAt: Date.now(),
        };

        // Check if log already exists for this habit+date, update instead
        const existing = get().habitLogs.find((l) => l.habitId === habitId && l.date === date);

        if (existing) {
          set((state) => ({
            habitLogs: state.habitLogs.map((l) =>
              l.habitId === habitId && l.date === date ? { ...l, completed, updatedAt: Date.now() } : l
            ),
          }));

          queueOperation(set, get, {
            type: 'update',
            table: 'habit_logs',
            data: { completed, updated_at: Date.now() },
          }, async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            await supabase
              .from('habit_logs')
              .update({ completed, updated_at: Date.now() })
              .eq('user_id', user.id)
              .eq('id', existing.id);
          });
        } else {
          set((state) => ({ habitLogs: [...state.habitLogs, log] }));

          queueOperation(set, get, {
            type: 'insert',
            table: 'habit_logs',
            data: log,
          }, async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            await supabase.from('habit_logs').insert([{ ...log, user_id: user.id }]);
          });
        }
      },

      getHabitsForWeek: (weekStr) => {
        return get().habits.filter((h) => {
          if (h.archivedAt) return false;
          if (weekStr < h.appliesFromWeek) return false;
          if (h.appliesUntilWeek && weekStr > h.appliesUntilWeek) return false;
          return true;
        });
      },

      getLogsForWeek: (weekStr) => {
        const year = parseInt(weekStr.substring(0, 4));
        const week = parseInt(weekStr.substring(6, 8));

        // Calculate start and end dates of ISO week
        const jan4 = new Date(year, 0, 4);
        const weekStart = new Date(jan4);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday of week 1
        const daysOffset = (week - 1) * 7;
        weekStart.setDate(weekStart.getDate() + daysOffset);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6); // Sunday of that week

        return get().habitLogs.filter((log) => {
          const logDate = new Date(log.date);
          return logDate >= weekStart && logDate <= weekEnd;
        });
      },

      getLogsForHabitInWeek: (habitId, weekStr) => {
        return get().getLogsForWeek(weekStr).filter((l) => l.habitId === habitId);
      },

      getWeekStats: (weekStr) => {
        const habitsInWeek = get().getHabitsForWeek(weekStr);
        const logsInWeek = get().getLogsForWeek(weekStr);

        // Calculate applicable days: for each habit, count how many of its applicable days are in this week
        let totalApplicableDays = 0;
        let totalCompleted = 0;

        for (const habit of habitsInWeek) {
          // Count days of week for this habit in this week
          const year = parseInt(weekStr.substring(0, 4));
          const week = parseInt(weekStr.substring(6, 8));

          const jan4 = new Date(year, 0, 4);
          const weekStart = new Date(jan4);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
          const daysOffset = (week - 1) * 7;
          weekStart.setDate(weekStart.getDate() + daysOffset);

          for (let i = 0; i < 7; i++) {
            const currentDate = new Date(weekStart);
            currentDate.setDate(currentDate.getDate() + i);
            const dayOfWeek = (currentDate.getDay() + 6) % 7; // Convert to 0=Monday

            if (habit.daysOfWeek.includes(dayOfWeek)) {
              totalApplicableDays++;
              const dateStr = currentDate.toISOString().split('T')[0];
              const log = logsInWeek.find((l) => l.habitId === habit.id && l.date === dateStr);
              if (log?.completed) {
                totalCompleted++;
              }
            }
          }
        }

        const percentage = totalApplicableDays > 0 ? Math.round((totalCompleted / totalApplicableDays) * 100) : 0;

        return { totalApplicableDays, totalCompleted, percentage };
      },

      setGuestMode: (isGuest) => set({ guestMode: isGuest }),
      setError: (error) => set({ error }),

      processPendingOperations: async () => {
        if (!navigator.onLine) return;

        const state = get();
        for (const op of state.pendingOperations) {
          try {
            if (op.table === 'habits') {
              if (op.type === 'insert') {
                await supabase.from('habits').insert([op.data]);
              } else if (op.type === 'update') {
                await supabase.from('habits').update(op.data).eq('id', op.habitId);
              }
            } else if (op.table === 'habit_logs') {
              if (op.type === 'insert') {
                await supabase.from('habit_logs').insert([op.data]);
              } else if (op.type === 'update') {
                await supabase.from('habit_logs').update(op.data);
              }
            }
          } catch (err) {
            console.error('Failed to process pending operation:', err);
            return;
          }
        }

        set({ pendingOperations: [] });
      },
    }),
    {
      name: 'habit-store',
      partialize: (state) => ({
        habits: state.habits,
        habitLogs: state.habitLogs,
        pendingOperations: state.pendingOperations,
      }),
    }
  )
);
