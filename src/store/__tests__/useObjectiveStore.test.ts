import { describe, it, expect, beforeEach, vi } from 'vitest';

// Controllable Supabase mock — same shape as the habit/task/adventure tests.
const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  selectResults: {} as Record<string, { data: any[]; error: any }>,
  writeResult: { data: null as any, error: null as any },
  calls: [] as Array<{ table: string; op: string; args: any; opts?: any }>,
  onSelect: null as null | (() => void),
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
      in: () => builder,
      then: (resolve: any) => {
        if (op === 'select') {
          h.onSelect?.();
          return resolve(h.selectResults[table] ?? { data: [], error: null });
        }
        return resolve(h.writeResult);
      },
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
let readCount = 0;

const reset = (over: any = {}) =>
  useObjectiveStore.setState({
    objectives: [], pendingOperations: [], guestMode: false,
    seeded: false, hydrated: false, error: null, isLoading: false,
    ...over,
  });

const active = () => useObjectiveStore.getState().objectives.filter(o => !o.archivedAt);
const ids = () => active().map(o => o.id);

// The wording each default shipped with before the polish release.
const LEGACY_PEACE_BODY = 'Increase my patient acceptance of every moment, so that I can experience peace.';
const LEGACY_LOVE_BODY = 'Love my immediate family, broader family, friends and colleagues.';

const row = (over: any = {}) => ({
  id: 'r1', title: 'Peace', essence: 'Accept each moment as it is.',
  body: SEED_OBJECTIVES[0].body, color: '#0EA5E9', order: 0,
  createdAt: 2000, archivedAt: null, ...over,
});

// The same row as Supabase hands it back.
const dbRow = (over: any = {}) => {
  const o = row(over);
  return {
    id: o.id, title: o.title, essence: o.essence, body: o.body, color: o.color,
    order: o.order, created_at: String(o.createdAt), archived_at: o.archivedAt,
  };
};

// What Mike's account actually looked like: every objective seeded twice, once
// in the original wording and once in the current one.
const doubled = [
  row({ id: 'old-1', title: 'Peace', body: LEGACY_PEACE_BODY, createdAt: 100, order: 0 }),
  row({ id: 'new-1', title: 'Peace', body: SEED_OBJECTIVES[0].body, createdAt: 200, order: 0 }),
  row({ id: 'old-2', title: 'Love', body: LEGACY_LOVE_BODY, createdAt: 101, order: 1 }),
  row({ id: 'new-2', title: 'Love', body: SEED_OBJECTIVES[1].body, createdAt: 201, order: 1 }),
];
const toDb = (o: any) => dbRow(o);

beforeEach(() => {
  h.user = { id: 'user-1' };
  h.selectResults = {};
  h.writeResult = { data: null, error: null };
  h.calls = [];
  readCount = 0;
  h.onSelect = () => { readCount += 1; };
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
    const first = ids();

    reset({ hydrated: true });
    useObjectiveStore.getState().seedIfEmpty();
    expect(ids()).toEqual(first);
    expect(first).toEqual(['obj-peace', 'obj-love', 'obj-hlth', 'obj-perf', 'obj-advn']);
  });

  it('will not seed a signed-in device before the read has landed', () => {
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

describe('useObjectiveStore — reading', () => {
  it('does not push a locally-seeded default onto an account that already has objectives', async () => {
    reset({ objectives: [row({ id: 'obj-peace' })], seeded: true });
    h.selectResults['objectives'] = { data: [dbRow({ id: 'r1' })], error: null };

    await useObjectiveStore.getState().fetchObjectives();
    await flush();

    expect(ids()).toEqual(['r1']);
    expect(writesTo('objectives')).toHaveLength(0);
  });

  it('still pushes up a genuinely local objective Mike wrote himself', async () => {
    reset({ objectives: [row({ id: 'mine', title: 'Sabbatical', body: 'Take three months off.' })], seeded: true });
    h.selectResults['objectives'] = { data: [dbRow({ id: 'r1' })], error: null };

    await useObjectiveStore.getState().fetchObjectives();
    await flush();

    expect(ids().sort()).toEqual(['mine', 'r1']);
    expect(writesTo('objectives').filter(c => c.op === 'upsert')).toHaveLength(1);
  });

  it('a failed push-up no longer throws away the read that worked', async () => {
    reset({ objectives: [row({ id: 'mine', title: 'Sabbatical', body: 'Take three months off.' })], seeded: true });
    h.selectResults['objectives'] = { data: doubled.map(toDb), error: null };
    h.writeResult = { data: null, error: { message: 'boom' } };

    await useObjectiveStore.getState().fetchObjectives();
    await flush();

    // The write is queued for retry, and the sweep still ran on the read.
    expect(useObjectiveStore.getState().hydrated).toBe(true);
    expect(useObjectiveStore.getState().pendingOperations.length).toBeGreaterThan(0);
    expect(ids().sort()).toEqual(['mine', 'new-1', 'new-2']);
  });

  it('runs one read at a time, so a slower reply cannot undo the sweep', async () => {
    reset({ seeded: true });
    h.selectResults['objectives'] = { data: doubled.map(toDb), error: null };

    await Promise.all([
      useObjectiveStore.getState().fetchObjectives(),
      useObjectiveStore.getState().fetchObjectives(),
    ]);
    await flush();

    expect(readCount).toBe(1);
    expect(ids()).toEqual(['new-1', 'new-2']);
  });

  it('keeps a local delete that has not synced, even though the DB still lists the row', async () => {
    reset({ objectives: [row({ id: 'r1', archivedAt: 5 })], seeded: true });
    h.selectResults['objectives'] = { data: [dbRow({ id: 'r1' })], error: null };

    await useObjectiveStore.getState().fetchObjectives();
    await flush();

    expect(ids()).toEqual([]);
  });

  it('a failed read neither hydrates nor seeds — no defaults on top of a bad network', async () => {
    h.selectResults['objectives'] = { data: null as any, error: { message: 'offline' } };

    await useObjectiveStore.getState().fetchObjectives();
    await flush();

    const s = useObjectiveStore.getState();
    expect(s.hydrated).toBe(false);
    expect(s.objectives).toHaveLength(0);
    expect(s.error).toBe('offline');
  });

  it('seeds after the read when the account really is empty', async () => {
    h.selectResults['objectives'] = { data: [], error: null };

    await useObjectiveStore.getState().fetchObjectives();
    await flush();

    expect(ids()).toEqual(['obj-peace', 'obj-love', 'obj-hlth', 'obj-perf', 'obj-advn']);
  });
});

describe('useObjectiveStore — the duplicate sweep', () => {
  it('archives the stale copy of each doubled objective and keeps the current wording', () => {
    reset({ objectives: doubled, hydrated: true, seeded: true });
    useObjectiveStore.getState().sweepDuplicateSeeds();

    expect(ids()).toEqual(['new-1', 'new-2']);
  });

  it('recognises a stale default through smart-quote and whitespace drift', () => {
    const drifted = SEED_OBJECTIVES[4].body
      .replace(/‘|’/g, "'")
      .replace(/“|”/g, '"')
      .replace(/\n/g, '\n ');
    reset({
      objectives: [
        row({ id: 'drifted', title: 'Adventure', body: drifted, createdAt: 100 }),
        row({ id: 'clean', title: 'Adventure', body: SEED_OBJECTIVES[4].body, createdAt: 200 }),
      ],
      hydrated: true, seeded: true,
    });
    useObjectiveStore.getState().sweepDuplicateSeeds();

    expect(ids()).toHaveLength(1);
  });

  it('tries again on the next read instead of spending itself on one attempt', () => {
    reset({ objectives: doubled, hydrated: true, seeded: true });
    useObjectiveStore.getState().sweepDuplicateSeeds();

    // Whatever put the duplicates back — a stale reply, a write that never
    // landed — the next pass clears them again rather than giving up.
    useObjectiveStore.setState({ objectives: doubled });
    useObjectiveStore.getState().sweepDuplicateSeeds();
    expect(ids()).toEqual(['new-1', 'new-2']);
  });

  it('is a no-op once the page is clean, so it costs nothing to repeat', () => {
    reset({ objectives: [row({ id: 'new-1' })], hydrated: true, seeded: true });
    useObjectiveStore.getState().sweepDuplicateSeeds();

    expect(ids()).toEqual(['new-1']);
    expect(writesTo('objectives')).toHaveLength(0);
  });

  it('never touches something Mike has written, even when the title is doubled', () => {
    reset({
      objectives: [
        row({ id: 'edited', title: 'Peace', body: 'Sit with it. Ten minutes, every morning.', createdAt: 100 }),
        row({ id: 'default', title: 'Peace', body: SEED_OBJECTIVES[0].body, createdAt: 200 }),
      ],
      hydrated: true, seeded: true,
    });
    useObjectiveStore.getState().sweepDuplicateSeeds();

    expect(ids()).toEqual(['edited', 'default']);
  });

  it('a new objective sharing a default title cannot make the real one vanish', () => {
    reset({ objectives: [row({ id: 'obj-peace' })], hydrated: true, seeded: true });
    useObjectiveStore.getState().addObjective('Peace', '#0EA5E9');
    useObjectiveStore.getState().sweepDuplicateSeeds();

    expect(ids()).toContain('obj-peace');
    expect(ids()).toHaveLength(2);
  });

  it('holds off until the read has landed, so it does not judge a stale list', () => {
    reset({ objectives: doubled, seeded: true });
    useObjectiveStore.getState().sweepDuplicateSeeds();

    expect(active()).toHaveLength(4);
  });

  it('archives the whole sweep in one statement so it cannot half-apply', async () => {
    reset({ objectives: doubled, hydrated: true, seeded: true });
    useObjectiveStore.getState().sweepDuplicateSeeds();
    await flush();

    const updates = writesTo('objectives').filter(c => c.op === 'update');
    expect(updates).toHaveLength(1);
    expect(updates[0].args.archived_at).toBeGreaterThan(0);
  });

  it('queues the archive when it cannot be written, and replays it later', async () => {
    reset({ objectives: doubled, hydrated: true, seeded: true });
    h.writeResult = { data: null, error: { message: 'boom' } };
    useObjectiveStore.getState().sweepDuplicateSeeds();
    await flush();

    const queued = useObjectiveStore.getState().pendingOperations;
    expect(queued).toHaveLength(1);
    expect(queued[0].type).toBe('archive');
    expect(queued[0].objectiveIds).toEqual(['old-1', 'old-2']);

    h.writeResult = { data: null, error: null };
    h.calls = [];
    await useObjectiveStore.getState().processPendingOperations();

    expect(useObjectiveStore.getState().pendingOperations).toHaveLength(0);
    expect(writesTo('objectives').filter(c => c.op === 'update')).toHaveLength(1);
  });
});
