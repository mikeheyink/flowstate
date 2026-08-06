import { describe, it, expect, beforeEach, vi } from 'vitest';

// Controllable Supabase mock — same shape as the habit/task store tests.
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

import { useAdventureStore, CATEGORY_SEED_VERSION } from '../useAdventureStore';

const setOnline = (online: boolean) =>
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });

const flush = async () => { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); };
const writesTo = (table: string) => h.calls.filter((c) => c.table === table);

const reset = (over: any = {}) =>
  useAdventureStore.setState({
    adventures: [], categories: [], pendingOperations: [],
    guestMode: false, seeded: false, error: null,
    categorySeedVersion: CATEGORY_SEED_VERSION, pendingEditId: null, ...over,
  });

beforeEach(() => {
  h.user = { id: 'user-1' };
  h.selectResults = {};
  h.writeResult = { data: null, error: null };
  h.calls = [];
  setOnline(true);
  reset();
});

describe('useAdventureStore — seeding', () => {
  it('seeds the preset kinds and the real adventures on a fresh device', () => {
    useAdventureStore.getState().seedIfEmpty();
    const s = useAdventureStore.getState();

    expect(s.seeded).toBe(true);
    expect(s.categories.map(c => c.id)).toEqual(['golf', 'family', 'travel', 'trailrun', 'other']);
    expect(s.adventures.map(a => a.title)).toEqual([
      'China Trip', 'Erinvale Golf', 'Wolseley Weekend', 'Pringle Bay Weekend',
      'Drakensberg', 'Zimbali', 'Japan Trip', 'MUT George', 'Golf Tour',
      'Onrus Trip', 'Arabella Golf',
    ]);
  });

  it('dates the calendar adventures and leaves the potential ones as seeds', () => {
    useAdventureStore.getState().seedIfEmpty();
    const byTitle = (t: string) => useAdventureStore.getState().adventures.find(a => a.title === t)!;

    const china = byTitle('China Trip');
    expect(china.date).not.toBeNull();
    const d = new Date(china.date!);
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 6, 26]);

    expect(byTitle('Japan Trip').date).toBeNull();
    expect(byTitle('Arabella Golf').notes).toBe('Flook deal');
  });

  it('does not re-seed once seeded, so deleting everything stays deleted', () => {
    useAdventureStore.getState().seedIfEmpty();
    useAdventureStore.setState({ adventures: [], categories: [] });

    useAdventureStore.getState().seedIfEmpty();
    expect(useAdventureStore.getState().adventures).toHaveLength(0);
  });

  it('marks itself seeded without duplicating when content already exists', () => {
    reset({ adventures: [{ id: 'a1', title: 'Kilimanjaro', notes: '', categoryId: null, date: null, lived: false, externalEventId: null, order: 0, createdAt: 1, archivedAt: null }] });

    useAdventureStore.getState().seedIfEmpty();
    const s = useAdventureStore.getState();
    expect(s.seeded).toBe(true);
    expect(s.adventures).toHaveLength(1);
  });
});

describe('useAdventureStore — planting and categorising', () => {
  it('a new row starts empty and untitled, ready to be typed into', () => {
    const id = useAdventureStore.getState().addAdventure();
    const a = useAdventureStore.getState().adventures.find(x => x.id === id)!;
    expect(a.title).toBe('');
    expect(a.date).toBeNull();
    expect(a.lived).toBe(false);
  });

  it('flags the new row for the inline editor so ↵ types straight into it', () => {
    const id = useAdventureStore.getState().addAdventure();
    expect(useAdventureStore.getState().pendingEditId).toBe(id);

    useAdventureStore.getState().setPendingEditId(null);
    expect(useAdventureStore.getState().pendingEditId).toBeNull();
  });

  it('a new seed lands at the top of the Seedbed', () => {
    const first = useAdventureStore.getState().addAdventure('First');
    const second = useAdventureStore.getState().addAdventure('Second');
    const orderOf = (id: string) => useAdventureStore.getState().adventures.find(a => a.id === id)!.order;
    expect(orderOf(second)).toBeLessThan(orderOf(first));
  });

  it('cycleCategory walks the kinds in order then back to uncategorised', () => {
    useAdventureStore.getState().seedIfEmpty();
    const id = useAdventureStore.getState().addAdventure('Sea kayak');
    const cycle = () => useAdventureStore.getState().cycleCategory(id);

    expect(cycle()).toBe('golf');
    expect(cycle()).toBe('family');
    expect(cycle()).toBe('travel');
    expect(cycle()).toBe('trailrun');
    expect(cycle()).toBe('other');
    // Past the last kind, back to no kind at all.
    expect(cycle()).toBeNull();
  });

  it('moveAdventure reorders seeds but ignores dated adventures', () => {
    const mk = (id: string, order: number, date: number | null) =>
      ({ id, title: id, notes: '', categoryId: null, date, lived: false, externalEventId: null, order, createdAt: order, archivedAt: null });
    reset({ adventures: [mk('s1', 0, null), mk('s2', 1, null), mk('dated', 2, 999)], seeded: true });

    useAdventureStore.getState().moveAdventure('s2', 'up');
    const orderOf = (id: string) => useAdventureStore.getState().adventures.find(a => a.id === id)!.order;
    expect(orderOf('s2')).toBeLessThan(orderOf('s1'));

    // A dated adventure isn't part of the Seedbed, so reordering it is a no-op.
    const before = orderOf('dated');
    useAdventureStore.getState().moveAdventure('dated', 'up');
    expect(orderOf('dated')).toBe(before);
  });

  it('removeAdventure soft-deletes rather than dropping the row', () => {
    const id = useAdventureStore.getState().addAdventure('Regret');
    useAdventureStore.getState().removeAdventure(id);
    const a = useAdventureStore.getState().adventures.find(x => x.id === id)!;
    expect(a.archivedAt).toBeGreaterThan(0);
  });
});

describe('useAdventureStore — the kinds migration', () => {
  const legacyCats = [
    { id: 'travel', label: 'Travel', color: '#0EA5E9', order: 0, createdAt: 1, archivedAt: null },
    { id: 'outdoors', label: 'Outdoors', color: '#10B981', order: 1, createdAt: 2, archivedAt: null },
    { id: 'thrill', label: 'Thrill', color: '#EF4444', order: 5, createdAt: 3, archivedAt: null },
  ];
  const adv = (id: string, categoryId: string | null) =>
    ({ id, title: id, notes: '', categoryId, date: null, lived: false, externalEventId: null, order: 0, createdAt: 1, archivedAt: null });

  it('replaces the first release\'s kinds with the current five', () => {
    reset({ categories: legacyCats, adventures: [], seeded: true, categorySeedVersion: 1 });
    useAdventureStore.getState().migrateCategories();

    const s = useAdventureStore.getState();
    expect(s.categories.filter(c => !c.archivedAt).map(c => c.id))
      .toEqual(['golf', 'family', 'travel', 'trailrun', 'other']);
    expect(s.categorySeedVersion).toBe(CATEGORY_SEED_VERSION);
  });

  it('re-tags adventures that pointed at a retired kind', () => {
    reset({
      categories: legacyCats,
      adventures: [adv('a-outdoors', 'outdoors'), adv('a-thrill', 'thrill'), adv('a-none', null)],
      seeded: true, categorySeedVersion: 1,
    });
    useAdventureStore.getState().migrateCategories();

    const catOf = (id: string) => useAdventureStore.getState().adventures.find(a => a.id === id)!.categoryId;
    expect(catOf('a-outdoors')).toBe('family');
    expect(catOf('a-thrill')).toBe('trailrun');
    expect(catOf('a-none')).toBeNull();
  });

  it('keeps kinds the user added themselves', () => {
    const custom = { id: 'abc1234', label: 'Surfing', color: '#111111', order: 9, createdAt: 5, archivedAt: null };
    reset({ categories: [...legacyCats, custom], adventures: [], seeded: true, categorySeedVersion: 1 });
    useAdventureStore.getState().migrateCategories();

    const live = useAdventureStore.getState().categories.filter(c => !c.archivedAt);
    expect(live.map(c => c.label)).toContain('Surfing');
    expect(live.find(c => c.id === 'abc1234')!.color).toBe('#111111');
  });

  it('is idempotent — a second run changes nothing', () => {
    reset({ categories: legacyCats, adventures: [adv('a1', 'outdoors')], seeded: true, categorySeedVersion: 1 });
    useAdventureStore.getState().migrateCategories();
    const after = JSON.stringify(useAdventureStore.getState().categories.filter(c => !c.archivedAt));

    useAdventureStore.getState().migrateCategories();
    expect(JSON.stringify(useAdventureStore.getState().categories.filter(c => !c.archivedAt))).toBe(after);
    expect(useAdventureStore.getState().adventures.find(a => a.id === 'a1')!.categoryId).toBe('family');
  });

  it('just stamps the version on a device that never seeded', () => {
    reset({ categories: [], adventures: [], seeded: false, categorySeedVersion: 1 });
    useAdventureStore.getState().migrateCategories();

    const s = useAdventureStore.getState();
    expect(s.categories).toHaveLength(0);
    expect(s.categorySeedVersion).toBe(CATEGORY_SEED_VERSION);
  });
});

describe('useAdventureStore — offline-first writes', () => {
  it('queues writes while offline and replays them when back online', async () => {
    setOnline(false);
    useAdventureStore.getState().addAdventure('Patagonia');
    await flush();

    expect(writesTo('adventures')).toHaveLength(0);
    expect(useAdventureStore.getState().pendingOperations).toHaveLength(1);

    setOnline(true);
    await useAdventureStore.getState().processPendingOperations();
    await flush();

    expect(writesTo('adventures').some(c => c.op === 'upsert')).toBe(true);
    expect(useAdventureStore.getState().pendingOperations).toHaveLength(0);
  });

  it('keeps a failed write queued for retry', async () => {
    h.writeResult = { data: null, error: { message: 'boom', code: 'XX000' } };
    useAdventureStore.getState().addAdventure('Everest');
    await flush();

    expect(useAdventureStore.getState().pendingOperations).toHaveLength(1);
  });

  it('never writes in guest mode', async () => {
    reset({ guestMode: true });
    useAdventureStore.getState().addAdventure('Local only');
    await flush();

    expect(h.calls).toHaveLength(0);
    expect(useAdventureStore.getState().pendingOperations).toHaveLength(0);
    expect(useAdventureStore.getState().adventures).toHaveLength(1);
  });

  it('pushes local-only rows up to the DB on fetch', async () => {
    reset({
      adventures: [{ id: 'local1', title: 'Namib', notes: '', categoryId: null, date: null, lived: false, externalEventId: null, order: 0, createdAt: 1, archivedAt: null }],
      seeded: true,
    });
    h.selectResults = { adventures: { data: [], error: null }, adventure_categories: { data: [], error: null } };

    await useAdventureStore.getState().fetchAdventures();
    await flush();

    const upserts = writesTo('adventures').filter(c => c.op === 'upsert');
    expect(upserts.length).toBeGreaterThan(0);
    expect(upserts[0].args[0]).toMatchObject({ id: 'local1', user_id: 'user-1' });
  });
});
