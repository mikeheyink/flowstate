import { describe, it, expect, beforeEach, vi } from 'vitest';

// Controllable Supabase mock. `h` is hoisted so the vi.mock factory can read it.
const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  selectResults: {} as Record<string, { data: any[]; error: any }>,
  writeResult: { data: null as any, error: null as any },
  calls: [] as Array<{ table: string; op: string; args: any; opts?: any }>,
}));

vi.mock('../../utils/supabase', () => {
  const makeFrom = (table: string) => {
    let op = 'select';
    const builder: any = {
      select: () => builder,
      insert: (args: any) => { op = 'insert'; h.calls.push({ table, op, args }); return builder; },
      update: (args: any) => { op = 'update'; h.calls.push({ table, op, args }); return builder; },
      upsert: (args: any, opts: any) => { op = 'upsert'; h.calls.push({ table, op, args, opts }); return builder; },
      delete: () => { op = 'delete'; h.calls.push({ table, op, args: null }); return builder; },
      eq: () => builder,
      is: () => builder,
      then: (resolve: any) =>
        resolve(op === 'select' ? (h.selectResults[table] ?? { data: [], error: null }) : h.writeResult),
    };
    return builder;
  };
  return {
    supabase: {
      auth: { getUser: vi.fn(async () => ({ data: { user: h.user }, error: null })) },
      from: (table: string) => makeFrom(table),
    },
  };
});

import { useHabitStore } from '../useHabitStore';

const setOnline = (online: boolean) =>
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });

const flush = async () => { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); };
const writesTo = (table: string) => h.calls.filter((c) => c.table === table);

const aHabit = (over: any = {}) => ({
  id: 'hab-1', title: 'Read', type: 'do', createdAt: 1, archivedAt: null,
  order: 1, appliesFromWeek: '2026-W01', appliesUntilWeek: null, daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
  ...over,
});

beforeEach(() => {
  h.user = { id: 'user-1' };
  h.selectResults = {};
  h.writeResult = { data: null, error: null };
  h.calls = [];
  setOnline(true);
  useHabitStore.setState({ habits: [], habitLogs: [], pendingOperations: [], guestMode: false, error: null });
});

describe('useHabitStore — persistence', () => {
  it('defaults to sync-enabled (guestMode false) and persists the flag', () => {
    expect(useHabitStore.getState().guestMode).toBe(false);
    useHabitStore.getState().setGuestMode(true);
    const persisted = JSON.parse(localStorage.getItem('habit-store')!);
    expect(persisted.state.guestMode).toBe(true);
  });

  it('marking a habit done writes status:done (+ legacy completed) to the DB', async () => {
    useHabitStore.getState().setHabitStatus('hab-1', '2026-06-16', 'done');
    await flush();

    const w = writesTo('habit_logs');
    expect(w).toHaveLength(1);
    expect(w[0].op).toBe('upsert');
    expect(w[0].opts).toEqual({ onConflict: 'habit_id,date' });
    expect(w[0].args).toMatchObject({
      habit_id: 'hab-1', date: '2026-06-16', status: 'done', completed: true, user_id: 'user-1',
    });
  });

  it('marking failed writes status:failed with completed:false', async () => {
    useHabitStore.getState().setHabitStatus('hab-1', '2026-06-16', 'failed');
    await flush();
    expect(writesTo('habit_logs')[0].args).toMatchObject({ status: 'failed', completed: false });
  });

  it('does NOT write in guest mode (but reflects locally)', async () => {
    useHabitStore.setState({ guestMode: true });
    useHabitStore.getState().setHabitStatus('hab-1', '2026-06-16', 'done');
    await flush();
    expect(writesTo('habit_logs')).toHaveLength(0);
    expect(useHabitStore.getState().habitLogs).toHaveLength(1);
  });

  it('queues offline, replays on reconnect', async () => {
    setOnline(false);
    useHabitStore.getState().setHabitStatus('hab-1', '2026-06-16', 'done');
    await flush();
    expect(writesTo('habit_logs')).toHaveLength(0);
    expect(useHabitStore.getState().pendingOperations[0].type).toBe('upsert');

    setOnline(true);
    await useHabitStore.getState().processPendingOperations();
    expect(writesTo('habit_logs')[0].op).toBe('upsert');
    expect(useHabitStore.getState().pendingOperations).toHaveLength(0);
  });

  it('keeps a failed write queued for retry', async () => {
    h.writeResult = { data: null, error: { message: 'boom', code: 'XX000' } };
    useHabitStore.getState().setHabitStatus('hab-1', '2026-06-16', 'done');
    await flush();
    expect(useHabitStore.getState().pendingOperations).toHaveLength(1);
    h.writeResult = { data: null, error: null };
    await useHabitStore.getState().processPendingOperations();
    expect(useHabitStore.getState().pendingOperations).toHaveLength(0);
  });

  it('fetchHabits migrates local-only logs instead of wiping them', async () => {
    useHabitStore.setState({
      habits: [aHabit()],
      habitLogs: [{ id: 'log-1', habitId: 'hab-1', date: '2026-06-16', status: 'done', updatedAt: 100 }],
    });
    h.selectResults = {
      habits: { data: [{ id: 'hab-1', title: 'Read', type: 'do', created_at: 1, archived_at: null, order: 1, applies_from_week: '2026-W01', applies_until_week: null, days_of_week: [0, 1, 2, 3, 4, 5, 6] }], error: null },
      habit_logs: { data: [], error: null },
    };
    await useHabitStore.getState().fetchHabits();

    const w = writesTo('habit_logs');
    expect(w).toHaveLength(1);
    expect(w[0].args[0]).toMatchObject({ habit_id: 'hab-1', date: '2026-06-16', status: 'done' });
    expect(useHabitStore.getState().habitLogs).toHaveLength(1);
  });
});

describe('useHabitStore — three-state cycle', () => {
  it('cycles pending → done → failed → pending on the same row', async () => {
    const s = () => useHabitStore.getState();
    const statusFor = () => s().habitLogs.find((l) => l.habitId === 'hab-1' && l.date === '2026-06-16')?.status ?? 'pending';

    s().cycleHabitStatus('hab-1', '2026-06-16');
    expect(statusFor()).toBe('done');
    const id1 = s().habitLogs[0].id;

    s().cycleHabitStatus('hab-1', '2026-06-16');
    expect(statusFor()).toBe('failed');

    s().cycleHabitStatus('hab-1', '2026-06-16');
    expect(statusFor()).toBe('pending');

    // Always the same single row — no churn, no duplicate id.
    expect(s().habitLogs).toHaveLength(1);
    expect(s().habitLogs[0].id).toBe(id1);
  });
});

describe('useHabitStore — getWeekStats (success rate excludes pending)', () => {
  it('percentage = ticks / (ticks + crosses); pending ignored', () => {
    const s = useHabitStore.getState();
    // A 7-day habit; mark 2 done, 1 failed, leave 4 pending in week 2026-W25.
    useHabitStore.setState({ habits: [aHabit()] });
    s.setHabitStatus('hab-1', '2026-06-15', 'done');   // Mon
    s.setHabitStatus('hab-1', '2026-06-16', 'done');   // Tue
    s.setHabitStatus('hab-1', '2026-06-17', 'failed');  // Wed

    const stats = useHabitStore.getState().getWeekStats('2026-W25');
    expect(stats.done).toBe(2);
    expect(stats.failed).toBe(1);
    expect(stats.evaluated).toBe(3);
    expect(stats.applicableDays).toBe(7);
    expect(stats.percentage).toBe(67); // 2/3
  });

  it('percentage is 0 when nothing is evaluated (all pending)', () => {
    useHabitStore.setState({ habits: [aHabit()] });
    const stats = useHabitStore.getState().getWeekStats('2026-W25');
    expect(stats.evaluated).toBe(0);
    expect(stats.percentage).toBe(0);
  });
});

describe('useHabitStore — persist migration v0→v1', () => {
  it('converts legacy `completed` logs to `status` on rehydrate', async () => {
    // Old-schema payload as written by a pre-three-state build.
    localStorage.setItem('habit-store', JSON.stringify({
      version: 0,
      state: {
        habits: [],
        habitLogs: [
          { id: 'a', habitId: 'h', date: '2026-06-16', completed: true, updatedAt: 1 },
          { id: 'b', habitId: 'h', date: '2026-06-17', completed: false, updatedAt: 1 },
        ],
        pendingOperations: [
          { id: 'op1', type: 'upsert', table: 'habit_logs', data: { id: 'a', habit_id: 'h', date: '2026-06-16', completed: true, updated_at: 1 } },
        ],
        guestMode: false,
      },
    }));

    await (useHabitStore as any).persist.rehydrate();

    const logs = useHabitStore.getState().habitLogs;
    expect(logs.find((l) => l.id === 'a')?.status).toBe('done');
    expect(logs.find((l) => l.id === 'b')?.status).toBe('pending');
    // Queued op also upgraded so replay doesn't reset status to the DB default.
    const op = useHabitStore.getState().pendingOperations[0];
    expect(op.data.status).toBe('done');
  });
});
