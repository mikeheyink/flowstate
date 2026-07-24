import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Habit, HabitLog, HabitStatus } from '../types';
import { supabase } from '../utils/supabase';
import { getWeekRange, getWeekStart, toLocalISO } from '../utils/habitDates';

const generateId = () => Math.random().toString(36).substring(2, 9);

interface PendingOperation {
  id: string;
  type: 'insert' | 'update' | 'delete' | 'upsert';
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
  addHabit: (title: string, type: 'do' | 'dont-do', daysOfWeek: number[], appliesFromWeek: string, extras?: { objectiveIds?: string[]; why?: string }) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  removeHabit: (id: string) => void; // soft-delete
  moveHabit: (id: string, direction: 'up' | 'down') => void; // reorder within the full list
  swapHabitOrder: (idA: string, idB: string) => void; // swap two habits' sort keys
  setHabitStatus: (habitId: string, date: string, status: HabitStatus) => void;
  cycleHabitStatus: (habitId: string, date: string) => void; // pending→done→failed→pending

  // Queries
  getHabitsForWeek: (weekStr: string) => Habit[];
  getLogsForWeek: (weekStr: string) => HabitLog[];
  getLogsForHabitInWeek: (habitId: string, weekStr: string) => HabitLog[];

  // Stats
  getWeekStats: (weekStr: string) => {
    done: number;
    failed: number;
    evaluated: number; // done + failed
    applicableDays: number;
    percentage: number; // done / evaluated (success rate), 0 when nothing evaluated
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
  // Prefer the array column; fall back to the legacy single objective_id for
  // rows written before multi-select (so a wrong deploy order degrades gracefully).
  objectiveIds: dbHabit.objective_ids ?? (dbHabit.objective_id ? [dbHabit.objective_id] : []),
  why: dbHabit.why ?? undefined,
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
  if (habit.objectiveIds !== undefined) dbObj.objective_ids = habit.objectiveIds;
  if (habit.why !== undefined) dbObj.why = habit.why;
  return dbObj;
};

const mapLogFromDb = (row: any): HabitLog => ({
  id: row.id,
  habitId: row.habit_id,
  date: row.date,
  // Prefer the new status column; fall back to the legacy boolean for rows
  // written before the migration (so a wrong deploy order degrades gracefully).
  status: row.status ? (row.status as HabitStatus) : (row.completed ? 'done' : 'pending'),
  updatedAt: row.updated_at != null ? parseInt(row.updated_at) : Date.now(),
});

const mapLogToDb = (log: Partial<HabitLog>) => {
  const dbObj: any = {};
  if (log.id !== undefined) dbObj.id = log.id;
  if (log.habitId !== undefined) dbObj.habit_id = log.habitId;
  if (log.date !== undefined) dbObj.date = log.date;
  if (log.status !== undefined) {
    dbObj.status = log.status;
    // Keep the legacy NOT NULL `completed` column populated for backward compat.
    dbObj.completed = log.status === 'done';
  }
  if (log.updatedAt !== undefined) dbObj.updated_at = log.updatedAt;
  return dbObj;
};

// pending → done → failed → pending
const nextStatus = (s: HabitStatus): HabitStatus =>
  s === 'pending' ? 'done' : s === 'done' ? 'failed' : 'pending';

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
  if (state.guestMode) return; // No account to sync to.

  if (!navigator.onLine) {
    const op: PendingOperation = { ...operation, id: generateId() };
    set({ pendingOperations: [...state.pendingOperations, op] });
    return;
  }

  try {
    await executeOnline();
  } catch (err) {
    // Don't lose the write: surface it for debugging and queue it for replay
    // once we're back online / authenticated. Silently swallowing here was why
    // habit toggles never reached the DB.
    console.warn('Habit sync failed, queuing for retry:', operation.type, operation.table, err);
    const op: PendingOperation = { ...operation, id: generateId() };
    set({ pendingOperations: [...state.pendingOperations, op] });
  }
};

// Resolve the authenticated user for a write. Throwing (rather than returning)
// when there's no user means the caller's catch queues the op for replay instead
// of silently dropping it.
const requireUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated — deferring habit write');
  return user;
};

export const useHabitStore = create<HabitState>()(
  persist(
    (set, get) => ({
      habits: [],
      habitLogs: [],
      isLoading: false,
      error: null,
      // Default to sync-enabled (mirrors the task store). The auth flow flips this
      // to true only for genuine guest sessions. The old `true` default — combined
      // with not persisting the flag — meant every reload silently disabled habit
      // sync, so toggles never reached the DB.
      guestMode: false,
      pendingOperations: [],

      fetchHabits: async () => {
        set({ isLoading: true });
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            // No authenticated owner — leave local/guest state intact, just stop.
            set({ error: null, isLoading: false });
            return;
          }

          const [{ data: habitsData, error: habitsError }, { data: logsData, error: logsError }] =
            await Promise.all([
              supabase.from('habits').select('*').eq('user_id', user.id).is('archived_at', null),
              supabase.from('habit_logs').select('*').eq('user_id', user.id),
            ]);

          if (habitsError) throw habitsError;
          if (logsError) throw logsError;

          const dbHabits = (habitsData || []).map(mapFromDb);
          const dbLogs = (logsData || []).map(mapLogFromDb);

          // Reconcile local → DB. Habit data only ever lived in localStorage while
          // sync was broken, so a blind replace here would erase the user's history.
          // Instead, push up anything the DB is missing (or that's locally fresher)
          // via idempotent upserts — habits before logs to satisfy the FK — then
          // merge. Once everything's synced this finds nothing to push.
          const local = get();
          const dbHabitIds = new Set(dbHabits.map((h) => h.id));
          const localOnlyHabits = local.habits.filter((h) => !h.archivedAt && !dbHabitIds.has(h.id));

          const knownHabitIds = new Set([...dbHabitIds, ...localOnlyHabits.map((h) => h.id)]);
          const dbLogByKey = new Map(dbLogs.map((l) => [`${l.habitId}|${l.date}`, l]));
          const localOnlyLogs = local.habitLogs.filter((l) => {
            if (!knownHabitIds.has(l.habitId)) return false; // would violate FK
            const dbLog = dbLogByKey.get(`${l.habitId}|${l.date}`);
            return !dbLog || l.updatedAt > dbLog.updatedAt; // missing, or local is newer
          });

          if (localOnlyHabits.length > 0) {
            const { error } = await supabase
              .from('habits')
              .upsert(localOnlyHabits.map((h) => ({ ...mapToDb(h), user_id: user.id })), { onConflict: 'id' });
            if (error) throw error;
          }
          if (localOnlyLogs.length > 0) {
            const { error } = await supabase
              .from('habit_logs')
              .upsert(
                localOnlyLogs.map((l) => {
                  // Reuse the existing DB row's id on conflict so we update in place
                  // rather than churning the primary key.
                  const dbLog = dbLogByKey.get(`${l.habitId}|${l.date}`);
                  return { ...mapLogToDb({ ...l, id: dbLog?.id ?? l.id }), user_id: user.id };
                }),
                { onConflict: 'habit_id,date' }
              );
            if (error) throw error;
          }

          // Merge: DB is the base; locally-fresher logs and local-only habits win.
          const mergedLogsByKey = new Map(dbLogByKey);
          for (const l of localOnlyLogs) mergedLogsByKey.set(`${l.habitId}|${l.date}`, l);

          set({
            habits: [...dbHabits, ...localOnlyHabits],
            habitLogs: [...mergedLogsByKey.values()],
            error: null,
          });
        } catch (err: any) {
          set({ error: err.message });
        } finally {
          set({ isLoading: false });
        }
      },

      addHabit: (title, type, daysOfWeek, appliesFromWeek, extras = {}) => {
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
          objectiveIds: extras.objectiveIds ?? [],
          why: extras.why,
        };

        set((state) => ({ habits: [...state.habits, habit] }));

        queueOperation(set, get, {
          type: 'insert',
          table: 'habits',
          data: mapToDb(habit),
        }, async () => {
          const user = await requireUser();
          const { error } = await supabase.from('habits').insert([{ ...mapToDb(habit), user_id: user.id }]);
          if (error) throw error;
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
          const user = await requireUser();
          const { error } = await supabase.from('habits').update(mapToDb(updates)).eq('id', id).eq('user_id', user.id);
          if (error) throw error;
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
        get().swapHabitOrder(active[idx].id, active[swapIdx].id);
      },

      swapHabitOrder: (idA, idB) => {
        // Swap the two habits' sort keys. Used by both the grid (full-list
        // neighbour) and the checklist (neighbour among the day's visible habits).
        const a = get().habits.find((h) => h.id === idA);
        const b = get().habits.find((h) => h.id === idB);
        if (!a || !b) return;
        const aKey = a.order ?? a.createdAt;
        const bKey = b.order ?? b.createdAt;
        get().updateHabit(a.id, { order: bKey });
        get().updateHabit(b.id, { order: aKey });
      },

      cycleHabitStatus: (habitId, date) => {
        const existing = get().habitLogs.find((l) => l.habitId === habitId && l.date === date);
        get().setHabitStatus(habitId, date, nextStatus(existing?.status ?? 'pending'));
      },

      setHabitStatus: (habitId, date, status) => {
        const now = Date.now();
        const existing = get().habitLogs.find((l) => l.habitId === habitId && l.date === date);

        // Reuse the existing row's id so the DB row keeps a stable primary key;
        // only mint a new id for a genuinely new (habit, date) entry.
        const log: HabitLog = {
          id: existing?.id ?? generateId(),
          habitId,
          date,
          status,
          updatedAt: now,
        };

        set((state) => ({
          habitLogs: existing
            ? state.habitLogs.map((l) =>
                l.habitId === habitId && l.date === date ? { ...l, status, updatedAt: now } : l
              )
            : [...state.habitLogs, log],
        }));

        // One idempotent upsert keyed on the (habit_id, date) unique constraint.
        // This is safe whether the row exists locally, in the DB, on another
        // device, or not at all — so retries and cross-device toggles can't fail
        // on a duplicate-key error the way a blind insert would.
        queueOperation(set, get, {
          type: 'upsert',
          table: 'habit_logs',
          data: mapLogToDb(log),
        }, async () => {
          const user = await requireUser();
          const { error } = await supabase
            .from('habit_logs')
            .upsert({ ...mapLogToDb(log), user_id: user.id }, { onConflict: 'habit_id,date' });
          if (error) throw error;
        });
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

        let applicableDays = 0;
        let done = 0;
        let failed = 0;

        // weekStart is Monday, so index i (0..6) already maps to day-of-week i.
        for (let i = 0; i < 7; i++) {
          const currentDate = new Date(weekStart);
          currentDate.setDate(currentDate.getDate() + i);
          const dateStr = toLocalISO(currentDate);

          for (const habit of habitsInWeek) {
            if (!habit.daysOfWeek.includes(i)) continue;
            applicableDays++;
            const log = logsInWeek.find((l) => l.habitId === habit.id && l.date === dateStr);
            if (log?.status === 'done') done++;
            else if (log?.status === 'failed') failed++;
          }
        }

        // Success rate = ticks / (ticks + crosses). Pending days are excluded
        // entirely — leaving a day unmarked never counts against you, only a cross does.
        const evaluated = done + failed;
        const percentage = evaluated > 0 ? Math.round((done / evaluated) * 100) : 0;

        return { done, failed, evaluated, applicableDays, percentage };
      },

      setGuestMode: (isGuest) => set({ guestMode: isGuest }),
      setError: (error) => set({ error }),

      processPendingOperations: async () => {
        if (!navigator.onLine) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return; // can't replay without an authenticated owner

        const state = get();
        const remaining: PendingOperation[] = [];
        for (const op of state.pendingOperations) {
          try {
            if (op.table === 'habits') {
              if (op.type === 'insert') {
                const { error } = await supabase.from('habits').insert([{ ...op.data, user_id: user.id }]);
                if (error) throw error;
              } else if (op.type === 'update') {
                const { error } = await supabase.from('habits').update(op.data).eq('id', op.habitId).eq('user_id', user.id);
                if (error) throw error;
              }
            } else if (op.table === 'habit_logs') {
              // Always upsert (keyed on habit_id,date) so replaying an op that
              // already partially landed can't fail on the unique constraint.
              const { error } = await supabase
                .from('habit_logs')
                .upsert({ ...op.data, user_id: user.id }, { onConflict: 'habit_id,date' });
              if (error) throw error;
            }
          } catch (err) {
            // Keep this op (and don't drop the rest) so a single bad write can't
            // strand the whole queue. It'll be retried on the next replay.
            console.warn('Failed to replay habit operation, will retry:', op.type, op.table, err);
            remaining.push(op);
          }
        }

        set({ pendingOperations: remaining });
      },
    }),
    {
      name: 'habit-store',
      version: 2,
      // v0 → v1: logs carried a boolean `completed`; convert to the 3-state
      // `status` (true → 'done', false → 'pending'). Also upgrade any queued
      // habit_log writes so replaying an old-format op doesn't overwrite a row's
      // status back to the 'pending' default.
      // v1 → v2: single objectiveId → objectiveIds array (multi-select).
      migrate: (persisted: any, version: number) => {
        if (!persisted) return persisted;
        if (version < 1) {
          if (Array.isArray(persisted.habitLogs)) {
            persisted.habitLogs = persisted.habitLogs.map((l: any) =>
              l && 'status' in l
                ? l
                : { id: l.id, habitId: l.habitId, date: l.date, status: l.completed ? 'done' : 'pending', updatedAt: l.updatedAt }
            );
          }
          if (Array.isArray(persisted.pendingOperations)) {
            persisted.pendingOperations = persisted.pendingOperations.map((op: any) =>
              op?.table === 'habit_logs' && op.data && !('status' in op.data) && 'completed' in op.data
                ? { ...op, data: { ...op.data, status: op.data.completed ? 'done' : 'pending' } }
                : op
            );
          }
        }
        if (version < 2 && Array.isArray(persisted.habits)) {
          persisted.habits = persisted.habits.map((h: any) => {
            if (!h || 'objectiveIds' in h) return h;
            const { objectiveId, ...rest } = h;
            return { ...rest, objectiveIds: objectiveId ? [objectiveId] : [] };
          });
        }
        return persisted;
      },
      partialize: (state) => ({
        habits: state.habits,
        habitLogs: state.habitLogs,
        pendingOperations: state.pendingOperations,
        guestMode: state.guestMode,
      }),
    }
  )
);
