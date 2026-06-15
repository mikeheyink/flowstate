import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Habit, HabitLog } from '../types';
import { supabase } from '../utils/supabase';
import { getWeekRange, getWeekStart, toLocalISO } from '../utils/habitDates';

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
  moveHabit: (id: string, direction: 'up' | 'down') => void; // manual reorder
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
  // Fall back to createdAt for rows saved before manual ordering existed.
  order: dbHabit.order != null ? parseFloat(dbHabit.order) : parseInt(dbHabit.created_at),
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
  if (habit.order !== undefined) dbObj.order = habit.order;
  if (habit.appliesFromWeek !== undefined) dbObj.applies_from_week = habit.appliesFromWeek;
  if (habit.appliesUntilWeek !== undefined) dbObj.applies_until_week = habit.appliesUntilWeek;
  if (habit.daysOfWeek !== undefined) dbObj.days_of_week = habit.daysOfWeek;
  return dbObj;
};

// Shared sort: manual order first, createdAt as a stable tiebreaker.
const byOrder = (a: Habit, b: Habit) =>
  (a.order ?? a.createdAt) - (b.order ?? b.createdAt) || a.createdAt - b.createdAt;

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
        const now = Date.now();
        // New habits go to the bottom of the current list.
        const maxOrder = get().habits.reduce((m, h) => Math.max(m, h.order ?? h.createdAt), 0);
        const habit: Habit = {
          id: generateId(),
          title,
          type,
          createdAt: now,
          archivedAt: null,
          order: maxOrder + 1,
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

      moveHabit: (id, direction) => {
        // Reorder within the full active list; swap sort keys with the neighbour.
        const active = get().habits.filter((h) => !h.archivedAt).sort(byOrder);
        const idx = active.findIndex((h) => h.id === id);
        if (idx === -1) return;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= active.length) return;

        const a = active[idx];
        const b = active[swapIdx];
        const aKey = a.order ?? a.createdAt;
        const bKey = b.order ?? b.createdAt;
        get().updateHabit(a.id, { order: bKey });
        get().updateHabit(b.id, { order: aKey });
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
        return get().habits
          .filter((h) => {
            if (h.archivedAt) return false;
            if (weekStr < h.appliesFromWeek) return false;
            if (h.appliesUntilWeek && weekStr > h.appliesUntilWeek) return false;
            return true;
          })
          .sort(byOrder);
      },

      getLogsForWeek: (weekStr) => {
        // Compare 'YYYY-MM-DD' strings directly — lexicographic order matches
        // chronological order for ISO dates, and avoids any UTC/local drift.
        const { startStr, endStr } = getWeekRange(weekStr);
        return get().habitLogs.filter((log) => log.date >= startStr && log.date <= endStr);
      },

      getLogsForHabitInWeek: (habitId, weekStr) => {
        return get().getLogsForWeek(weekStr).filter((l) => l.habitId === habitId);
      },

      getWeekStats: (weekStr) => {
        const habitsInWeek = get().getHabitsForWeek(weekStr);
        const logsInWeek = get().getLogsForWeek(weekStr);
        const weekStart = getWeekStart(weekStr);

        let totalApplicableDays = 0;
        let totalCompleted = 0;

        // weekStart is Monday, so index i (0..6) already maps to day-of-week i.
        for (let i = 0; i < 7; i++) {
          const currentDate = new Date(weekStart);
          currentDate.setDate(currentDate.getDate() + i);
          const dateStr = toLocalISO(currentDate);

          for (const habit of habitsInWeek) {
            if (!habit.daysOfWeek.includes(i)) continue;
            totalApplicableDays++;
            const log = logsInWeek.find((l) => l.habitId === habit.id && l.date === dateStr);
            if (log?.completed) totalCompleted++;
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
