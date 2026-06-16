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
      // PostgREST builders are thenable — resolve to the configured result.
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

// queueOperation runs async & fire-and-forget; let its microtasks settle.
const flush = async () => { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); };

const writesTo = (table: string) => h.calls.filter((c) => c.table === table);

beforeEach(() => {
  h.user = { id: 'user-1' };
  h.selectResults = {};
  h.writeResult = { data: null, error: null };
  h.calls = [];
  setOnline(true);
  useHabitStore.setState({ habits: [], habitLogs: [], pendingOperations: [], guestMode: false, error: null });
});

describe('useHabitStore sync', () => {
  it('defaults to sync-enabled (guestMode false) and persists the flag', () => {
    // The whole bug was guestMode defaulting true + not persisted.
    expect(useHabitStore.getState().guestMode).toBe(false);
    useHabitStore.getState().setGuestMode(true);
    const persisted = JSON.parse(localStorage.getItem('habit-store')!);
    expect(persisted.state.guestMode).toBe(true);
  });

  it('a checked habit is written to the DB (upsert on habit_id,date)', async () => {
    useHabitStore.getState().logHabit('hab-1', '2026-06-16', true);
    await flush();

    const logWrites = writesTo('habit_logs');
    expect(logWrites).toHaveLength(1);
    expect(logWrites[0].op).toBe('upsert');
    expect(logWrites[0].opts).toEqual({ onConflict: 'habit_id,date' });
    expect(logWrites[0].args).toMatchObject({
      habit_id: 'hab-1',
      date: '2026-06-16',
      completed: true,
      user_id: 'user-1',
    });
  });

  it('toggling off updates the same row (no duplicate id churn)', async () => {
    useHabitStore.getState().logHabit('hab-1', '2026-06-16', true);
    await flush();
    const firstId = useHabitStore.getState().habitLogs[0].id;
    h.calls = [];

    useHabitStore.getState().logHabit('hab-1', '2026-06-16', false);
    await flush();

    const logWrites = writesTo('habit_logs');
    expect(logWrites).toHaveLength(1);
    expect(logWrites[0].args).toMatchObject({ id: firstId, completed: false });
    // Local state still has exactly one row for that habit+date.
    expect(useHabitStore.getState().habitLogs).toHaveLength(1);
  });

  it('does NOT write to the DB in guest mode', async () => {
    useHabitStore.setState({ guestMode: true });
    useHabitStore.getState().logHabit('hab-1', '2026-06-16', true);
    await flush();
    expect(writesTo('habit_logs')).toHaveLength(0);
    // ...but the toggle is still reflected locally.
    expect(useHabitStore.getState().habitLogs).toHaveLength(1);
  });

  it('queues the write when offline, then replays it on reconnect', async () => {
    setOnline(false);
    useHabitStore.getState().logHabit('hab-1', '2026-06-16', true);
    await flush();
    expect(writesTo('habit_logs')).toHaveLength(0);
    expect(useHabitStore.getState().pendingOperations).toHaveLength(1);
    expect(useHabitStore.getState().pendingOperations[0].type).toBe('upsert');

    setOnline(true);
    await useHabitStore.getState().processPendingOperations();
    const logWrites = writesTo('habit_logs');
    expect(logWrites).toHaveLength(1);
    expect(logWrites[0].op).toBe('upsert');
    expect(useHabitStore.getState().pendingOperations).toHaveLength(0);
  });

  it('keeps a failed write queued for retry instead of dropping it', async () => {
    // DB rejects the write (e.g. transient error / RLS not yet ready).
    h.writeResult = { data: null, error: { message: 'boom', code: 'XX000' } };
    useHabitStore.getState().logHabit('hab-1', '2026-06-16', true);
    await flush();
    expect(useHabitStore.getState().pendingOperations).toHaveLength(1);

    // Recover: DB now accepts it.
    h.writeResult = { data: null, error: null };
    await useHabitStore.getState().processPendingOperations();
    expect(useHabitStore.getState().pendingOperations).toHaveLength(0);
  });

  it('fetchHabits migrates local-only logs up instead of wiping them', async () => {
    // Simulate the broken-sync legacy state: a habit + a checked log exist only
    // locally; the DB has the habit but not the log.
    useHabitStore.setState({
      habits: [{
        id: 'hab-1', title: 'Read', type: 'do', createdAt: 1, archivedAt: null,
        order: 1, appliesFromWeek: '2026-W01', appliesUntilWeek: null, daysOfWeek: [0, 1, 2, 3, 4],
      }],
      habitLogs: [{ id: 'log-1', habitId: 'hab-1', date: '2026-06-16', completed: true, updatedAt: 100 }],
    });
    h.selectResults = {
      habits: { data: [{
        id: 'hab-1', title: 'Read', type: 'do', created_at: 1, archived_at: null,
        order: 1, applies_from_week: '2026-W01', applies_until_week: null, days_of_week: [0, 1, 2, 3, 4],
      }], error: null },
      habit_logs: { data: [], error: null }, // DB has NO logs
    };

    await useHabitStore.getState().fetchHabits();

    // The local-only log was pushed up...
    const logWrites = writesTo('habit_logs');
    expect(logWrites).toHaveLength(1);
    expect(logWrites[0].op).toBe('upsert');
    expect(logWrites[0].opts).toEqual({ onConflict: 'habit_id,date' });
    // The reconciliation batch-upserts an array of local-only logs.
    expect(logWrites[0].args[0]).toMatchObject({ habit_id: 'hab-1', date: '2026-06-16', completed: true });
    // ...and survives in local state (not wiped by the fetch).
    const logs = useHabitStore.getState().habitLogs;
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ habitId: 'hab-1', completed: true });
  });
});
