import { describe, it, expect, beforeEach, vi } from 'vitest';

// Controllable Supabase mock — same shape as the habit/task/adventure tests.
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

import { useObjectiveStore, SEED_OBJECTIVES } from '../useObjectiveStore';

const setOnline = (online: boolean) =>
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });

const flush = async () => { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); };
const writesTo = (table: string) => h.calls.filter((c) => c.table === table && c.op !== 'select');

const reset = (over: any = {}) =>
  useObjectiveStore.setState({
    objectives: [], pendingOperations: [], guestMode: false,
    seeded: false, hydrated: false, dedupedSeeds: false, error: null, isLoading: false,
    ...over,
  });

const active = () => useObjectiveStore.getState().objectives.filter(o => !o.archivedAt);

// A row as it would come back from Supabase.
const dbRow = (over: any = {}) => ({
  id: 'r1', title: 'Peace', essence: 'Accept each moment as it is.',
  body: SEED_OBJECTIVES[0].body, color: '#0EA5E9', order: 0,
  created_at: '1000', archived_at: null, ...over,
});

// The wording each default shipped with before the polish release.
const LEGACY_PEACE_BODY = 'Increase my patient acceptance of every moment, so that I can experience peace.';
const LEGACY_LOVE_BODY = 'Love my immediate family, broader family, friends and colleagues.';

const local = (over: any = {}) => ({
  id: 'l1', title: 'Peace', essence: 'Accept each moment as it is.',
  body: SEED_OBJECTIVES[0].body, color: '#0EA5E9', order: 0,
  createdAt: 2000, archivedAt: null, ...over,
});

beforeEach(() => {
  h.user = { id: 'user-1' };
  h.selectResults = {};
  h.writeResult = { data: null, error: null };
  h.calls = [];
  setOnline(true);
  reset();
});

describe('useObjectiveStore — seeding', () => {
  it('seeds the five objectives on a fresh device once the DB has been seen', () => {
    reset({ hydrated: true });
    useObjectiveStore.getState().seedIfEmpty();

    const s = useObjectiveStore.getState();
    expect(s.seeded).toBe(true);
    expect(s.objectives.map(o => o.title)).toEqual([
      'Peace', 'Love', 'Health & Strength', 'Elite performance at Yellow', 'Adventure',
    ]);
  });

  it('gives the defaults fixed ids, so two devices seed the same five rows', () => {
    reset({ hydrated: true });
    useObjectiveStore.getState().seedIfEmpty();
    const first = useObjectiveStore.getState().objectives.map(o => o.id);

    reset({ hydrated: true });
    useObjectiveStore.getState().seedIfEmpty();
    expect(useObjectiveStore.getState().objectives.map(o => o.id)).toEqual(first);
    expect(first).toEqual(['obj-peace', 'obj-love', 'obj-hlth', 'obj-perf', 'obj-advn']);
  });

  it('will not seed a signed-in device before the fetch has landed', () => {
    useObjectiveStore.getState().seedIfEmpty();

    expect(useObjectiveStore.getState().objectives).toHaveLength(0);
    expect(useObjectiveStore.getState().seeded).toBe(false);
  });

  it('seeds a guest immediately — a guest has no DB to wait for', () => {
    reset({ guestMode: true });
    useObjectiveStore.getState().seedIfEmpty();
    expect(useObjectiveStore.getState().objectives).toHaveLength(5);
  });

  it('does not re-seed once seeded, so deleting them all stays deleted', () => {
    reset({ hydrated: true });
    useObjectiveStore.getState().seedIfEmpty();
    useObjectiveStore.setState({ objectives: [] });

    useObjectiveStore.getState().seedIfEmpty();
    expect(useObjectiveStore.getState().objectives).toHaveLength(0);
  });
});

describe('useObjectiveStore — fetch reconciliation', () => {
  it('does not push a locally-seeded default onto an account that already has objectives', async () => {
    reset({ objectives: [local({ id: 'obj-peace' })], seeded: true });
    h.selectResults['objectives'] = { data: [dbRow({ id: 'r1' })], error: null };

    await useObjectiveStore.getState().fetchObjectives();
    await flush();

    expect(active().map(o => o.id)).toEqual(['r1']);
    expect(writesTo('objectives')).toHaveLength(0);
  });

  it('still pushes up a genuinely local objective Mike wrote himself', async () => {
    reset({ objectives: [local({ id: 'mine', title: 'Sabbatical', body: 'Take three months off.' })], seeded: true });
    h.selectResults['objectives'] = { data: [dbRow({ id: 'r1' })], error: null };

    await useObjectiveStore.getState().fetchObjectives();
    await flush();

    expect(active().map(o => o.id).sort()).toEqual(['mine', 'r1']);
    expect(writesTo('objectives').filter(c => c.op === 'upsert')).toHaveLength(1);
  });

  it('a failed fetch neither hydrates nor seeds — no defaults on top of a bad network', async () => {
    h.selectResults['objectives'] = { data: null as any, error: { message: 'offline' } };

    await useObjectiveStore.getState().fetchObjectives();
    await flush();

    const s = useObjectiveStore.getState();
    expect(s.hydrated).toBe(false);
    expect(s.objectives).toHaveLength(0);
    expect(s.error).toBe('offline');
  });

  it('seeds after the fetch when the account really is empty', async () => {
    h.selectResults['objectives'] = { data: [], error: null };

    await useObjectiveStore.getState().fetchObjectives();
    await flush();

    expect(active().map(o => o.id)).toEqual(['obj-peace', 'obj-love', 'obj-hlth', 'obj-perf', 'obj-advn']);
  });
});

describe('useObjectiveStore — the double-seed cleanup', () => {
  const doubled = [
    local({ id: 'old-1', title: 'Peace', body: LEGACY_PEACE_BODY, createdAt: 100, order: 0 }),
    local({ id: 'new-1', title: 'Peace', body: SEED_OBJECTIVES[0].body, createdAt: 200, order: 0 }),
    local({ id: 'old-2', title: 'Love', body: LEGACY_LOVE_BODY, createdAt: 101, order: 1 }),
    local({ id: 'new-2', title: 'Love', body: SEED_OBJECTIVES[1].body, createdAt: 201, order: 1 }),
  ];

  it('archives the stale copy of each doubled objective and keeps the current wording', () => {
    reset({ objectives: doubled, hydrated: true, seeded: true });
    useObjectiveStore.getState().dedupeSeedDuplicates();

    expect(active().map(o => o.id)).toEqual(['new-1', 'new-2']);
    expect(useObjectiveStore.getState().dedupedSeeds).toBe(true);
  });

  it('runs only once, so a deliberate second copy stays put afterwards', () => {
    reset({ objectives: doubled, hydrated: true, seeded: true });
    useObjectiveStore.getState().dedupeSeedDuplicates();

    useObjectiveStore.setState({ objectives: doubled });
    useObjectiveStore.getState().dedupeSeedDuplicates();
    expect(active()).toHaveLength(4);
  });

  it('never archives something Mike has written, even when the title is doubled', () => {
    reset({
      objectives: [
        local({ id: 'edited', title: 'Peace', body: 'Sit with it. Ten minutes, every morning.', createdAt: 100 }),
        local({ id: 'default', title: 'Peace', body: SEED_OBJECTIVES[0].body, createdAt: 200 }),
      ],
      hydrated: true, seeded: true,
    });
    useObjectiveStore.getState().dedupeSeedDuplicates();

    expect(active().map(o => o.id)).toEqual(['edited']);
  });

  it('leaves two hand-written objectives that happen to share a title alone', () => {
    reset({
      objectives: [
        local({ id: 'a', title: 'Peace', body: 'Mine, one.', createdAt: 100 }),
        local({ id: 'b', title: 'Peace', body: 'Mine, two.', createdAt: 200 }),
      ],
      hydrated: true, seeded: true,
    });
    useObjectiveStore.getState().dedupeSeedDuplicates();

    expect(active()).toHaveLength(2);
  });

  it('holds off until the fetch has landed, so it does not spend itself on a stale list', () => {
    reset({ objectives: doubled, seeded: true });
    useObjectiveStore.getState().dedupeSeedDuplicates();

    expect(active()).toHaveLength(4);
    expect(useObjectiveStore.getState().dedupedSeeds).toBe(false);
  });

  it('syncs the archive so the duplicates go away on every device', async () => {
    reset({ objectives: doubled, hydrated: true, seeded: true });
    useObjectiveStore.getState().dedupeSeedDuplicates();
    await flush();

    const updates = writesTo('objectives').filter(c => c.op === 'update');
    expect(updates).toHaveLength(2);
    updates.forEach(u => expect(u.args.archived_at).toBeGreaterThan(0));
  });
});
