import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Objective } from '../types';
import { supabase } from '../utils/supabase';

const generateId = () => Math.random().toString(36).substring(2, 9);

interface PendingOperation {
  id: string;
  type: 'insert' | 'update' | 'archive';
  table: string;
  data?: any;
  objectiveId?: string;
  objectiveIds?: string[]; // 'archive' only — one statement for the whole sweep
}

interface ObjectiveState {
  objectives: Objective[];
  isLoading: boolean;
  error: string | null;
  guestMode: boolean;
  seeded: boolean; // one-time default seed guard (per device)
  hydrated: boolean; // a DB read has landed this session — NOT persisted

  pendingOperations: PendingOperation[];

  fetchObjectives: () => Promise<void>;
  seedIfEmpty: () => void;
  sweepDuplicateSeeds: () => void;
  addObjective: (title: string, color: string) => void;
  updateObjective: (id: string, updates: Partial<Objective>) => void;
  removeObjective: (id: string) => void; // soft-delete
  moveObjective: (id: string, direction: 'up' | 'down') => void;

  setGuestMode: (isGuest: boolean) => void;
  setError: (error: string | null) => void;
  processPendingOperations: () => Promise<void>;
}

// Mike's five objectives — the initial content of the page. Editable in-app;
// this is a starting point, not a schema. `essence` is the always-visible north
// star; `body` is markdown detail.
//
// The ids are fixed, not generated: two devices seeding the same defaults must
// land on the same five rows. With random ids they upserted side by side and
// the page showed each objective twice.
export const SEED_OBJECTIVES: (Omit<Objective, 'createdAt' | 'archivedAt'>)[] = [
  {
    id: 'obj-peace',
    title: 'Peace',
    color: '#0EA5E9',
    order: 0,
    essence: 'Accept each moment as it is.',
    body: 'Increase my patient acceptance of every moment, so that peace is the baseline — not the reward.',
  },
  {
    id: 'obj-love',
    title: 'Love',
    color: '#F43F5E',
    order: 1,
    essence: 'Show up fully for the people in my life.',
    body: 'Love my **immediate family**, **broader family**, **friends** and **colleagues**.',
  },
  {
    id: 'obj-hlth',
    title: 'Health & Strength',
    color: '#10B981',
    order: 2,
    essence: 'Build a body ready for adventure.',
    body: 'Increase my health, strength and fitness.\n\n**Measurable goal:** enter one exciting event.\n- MUT?\n- Otter Trail?',
  },
  {
    id: 'obj-perf',
    title: 'Elite performance at Yellow',
    color: '#F59E0B',
    order: 3,
    essence: 'Elite performance — through others.',
    body: '- **A · Decisions & strategy** — decision quality, resource allocation, problem-solving, entrepreneurship and vision.\n- **B · Leadership** — help my team achieve their potential, thrive and be happy.\n- **C · Technology** — leverage it for better outcomes and execution.\n- **D · People** — attract and select the best; set them up for team success.\n- **E · Partners** — cultivate a strong external reputation; attract and retain the best.',
  },
  {
    id: 'obj-advn',
    title: 'Adventure',
    color: '#8B5CF6',
    order: 4,
    essence: 'Be a kid — plan something every day.',
    body: 'Get excited about every day. Plan adventures, big and small.\n\n- Weekly / monthly adventure-planning check-in.\n- Daily: “What is today’s adventure?”',
  },
];

// Every body this app has ever seeded by default, keyed by title. This is how
// we tell an untouched default apart from something Mike actually wrote: an
// untouched default is safe to drop as a duplicate, his own words never are.
const LEGACY_SEED_BODIES: Record<string, string[]> = {
  'Peace': [
    'Increase my patient acceptance of every moment, so that I can experience peace.',
  ],
  'Love': [
    'Love my immediate family, broader family, friends and colleagues.',
  ],
  'Health & Strength': [
    'Increase my health, strength and fitness.\n\nMeasurable goals: enter an event that is exciting — MUT? Otter Trail?',
  ],
  'Elite performance at Yellow': [
    'A. Decisions, strategy, resource allocation and innovation — decision quality, problem-solving, entrepreneurship and vision.\nB. Leadership — help people in my team achieve their potential, thrive and be happy.\nC. Technology — leverage technology for better outcomes and execution.\nD. People — attract and select the best; set them up for team success.\nE. Partners — cultivate a strong external reputation; attract and retain the best partners.',
  ],
  'Adventure': [
    'Be a kid and get excited about every day. Plan adventures — big and small — every day.\n\nWeekly/monthly adventure planning check-in. Daily: “What is today’s adventure?”',
  ],
};

// Comparing seeded text across two years of builds, a SQL migration and a
// round-trip through Postgres: whitespace and smart punctuation drift, wording
// doesn't. Normalise the former so a stale default is still recognisable.
const norm = (s: string) =>
  (s ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const currentSeedFor = (title: string) => SEED_OBJECTIVES.find(s => s.title === title);

const seedBodiesFor = (title: string) => [
  ...(currentSeedFor(title) ? [currentSeedFor(title)!.body] : []),
  ...(LEGACY_SEED_BODIES[title] ?? []),
];

// True when this row is still exactly as the app seeded it — same title, and a
// body matching one of that title's shipped defaults (current or historical).
const isUntouchedSeed = (o: Objective) =>
  seedBodiesFor(o.title).some(b => norm(b) === norm(o.body));

const mapFromDb = (row: any): Objective => ({
  id: row.id,
  title: row.title,
  essence: row.essence ?? '',
  body: row.body ?? '',
  color: row.color ?? '#6674E4',
  order: row.order != null ? parseFloat(row.order) : 0,
  createdAt: parseInt(row.created_at),
  archivedAt: row.archived_at ? parseInt(row.archived_at) : null,
});

const mapToDb = (o: Partial<Objective>) => {
  const dbObj: any = {};
  if (o.id !== undefined) dbObj.id = o.id;
  if (o.title !== undefined) dbObj.title = o.title;
  if (o.essence !== undefined) dbObj.essence = o.essence;
  if (o.body !== undefined) dbObj.body = o.body;
  if (o.color !== undefined) dbObj.color = o.color;
  if (o.order !== undefined) dbObj.order = o.order;
  if (o.createdAt !== undefined) dbObj.created_at = o.createdAt;
  if (o.archivedAt !== undefined) dbObj.archived_at = o.archivedAt;
  return dbObj;
};

const requireUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated — deferring objective write');
  return user;
};

// Mirror of the habit store's offline-tolerant write path: try online, queue on
// failure, replay when connectivity/auth returns.
const queueOperation = async (
  set: any,
  get: any,
  operation: Omit<PendingOperation, 'id'>,
  executeOnline: () => Promise<any>
) => {
  const state = get();
  if (state.guestMode) return;

  if (!navigator.onLine) {
    set({ pendingOperations: [...state.pendingOperations, { ...operation, id: generateId() }] });
    return;
  }

  try {
    await executeOnline();
  } catch (err) {
    console.warn('Objective sync failed, queuing for retry:', operation.type, err);
    set({ pendingOperations: [...state.pendingOperations, { ...operation, id: generateId() }] });
  }
};

const byOrder = (a: Objective, b: Objective) => a.order - b.order || a.createdAt - b.createdAt;

// App calls fetchObjectives() twice on every load — once from getSession(),
// once from onAuthStateChange. Two reads in flight meant the slower reply
// landed last and overwrote the sweep's work with its own stale snapshot, so
// the duplicates reappeared for the rest of the session. One read at a time.
let inFlightFetch: Promise<void> | null = null;

export const useObjectiveStore = create<ObjectiveState>()(
  persist(
    (set, get) => ({
      objectives: [],
      isLoading: false,
      error: null,
      guestMode: false,
      seeded: false,
      hydrated: false,
      pendingOperations: [],

      fetchObjectives: () => {
        if (inFlightFetch) return inFlightFetch;
        inFlightFetch = (async () => {
          set({ isLoading: true });
          let read = false;
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
              .from('objectives')
              .select('*')
              .eq('user_id', user.id)
              .is('archived_at', null);
            if (error) throw error;

            const local = get();
            // A row this device has archived stays archived even while the DB
            // snapshot still shows it live — the delete may only be queued yet.
            // Without this, a read can undo a delete that hasn't synced.
            const archivedHere = new Map(
              local.objectives.filter(o => o.archivedAt).map(o => [o.id, o.archivedAt as number])
            );
            const dbObjectives = (data || [])
              .map(mapFromDb)
              .map(o => (archivedHere.has(o.id) ? { ...o, archivedAt: archivedHere.get(o.id)! } : o));

            // Push up anything the DB is missing (same pattern as habits). The
            // one thing we never push is an untouched default onto an account
            // that already has objectives — that is a locally-seeded copy of
            // rows the DB already holds under other ids, and pushing it is what
            // doubled the page in the first place.
            const dbIds = new Set(dbObjectives.map(o => o.id));
            const localOnly = local.objectives
              .filter(o => !o.archivedAt && !dbIds.has(o.id))
              .filter(o => !(dbObjectives.length > 0 && isUntouchedSeed(o)));

            set({ objectives: [...dbObjectives, ...localOnly].sort(byOrder), error: null });
            read = true;

            // Deliberately after the read is committed and outside its try: a
            // write that fails must not throw away a read that worked. It used
            // to, and that left seeding and the sweep dead on every load.
            if (localOnly.length > 0) {
              await queueOperation(
                set,
                get,
                { type: 'insert', table: 'objectives', data: localOnly.map(mapToDb) },
                async () => {
                  const { error: upErr } = await supabase
                    .from('objectives')
                    .upsert(localOnly.map(o => ({ ...mapToDb(o), user_id: user.id })), { onConflict: 'id' });
                  if (upErr) throw upErr;
                }
              );
            }
          } catch (err: any) {
            set({ error: err.message });
          } finally {
            set({ isLoading: false, hydrated: get().hydrated || read });
            // Only judge the page once we've actually seen the DB — never race
            // a slow network and mint a second set of defaults beside the real
            // ones. Both passes are idempotent, so they run on every read.
            if (read) {
              get().seedIfEmpty();
              get().sweepDuplicateSeeds();
            }
          }
        })();

        return inFlightFetch.finally(() => { inFlightFetch = null; });
      },

      // First run (per device): put the five objectives on the page so it never
      // opens empty. Guarded by `seeded` so deleting them all stays deleted.
      seedIfEmpty: () => {
        const state = get();
        if (state.seeded) return;
        if (state.objectives.filter(o => !o.archivedAt).length > 0) {
          set({ seeded: true });
          return;
        }
        // A signed-in device must see the DB before it decides the page is
        // empty. Guests have no DB to see, so they seed straight away.
        if (!state.guestMode && !state.hydrated) return;

        const now = Date.now();
        const seeds: Objective[] = SEED_OBJECTIVES.map((s, i) => ({
          ...s,
          createdAt: now + i,
          archivedAt: null,
        }));
        set({ objectives: seeds, seeded: true });

        seeds.forEach(o => {
          queueOperation(set, get, { type: 'insert', table: 'objectives', data: mapToDb(o) }, async () => {
            const user = await requireUser();
            const { error } = await supabase
              .from('objectives')
              .upsert([{ ...mapToDb(o), user_id: user.id }], { onConflict: 'id' });
            if (error) throw error;
          });
        });
      },

      // Devices that double-seeded show each objective twice — once in the
      // original wording, once in the current one. This sweeps the stale copy.
      //
      // It runs on every read, not once. The first attempt at this fix was
      // one-shot and guarded by a persisted flag; when it failed to stick, the
      // flag had already been spent and no later load ever tried again. Both
      // the rule and the write are idempotent, so repeating is free and the
      // page repairs itself the next time it loads.
      //
      // The rule is deliberately narrow. Only rows still matching a shipped
      // default are candidates, and only where a title has two or more of
      // them: anything Mike has written is never a candidate and never a
      // reason to archive, so adding a second objective called "Peace" cannot
      // make the real one disappear.
      sweepDuplicateSeeds: () => {
        const state = get();
        if (!state.guestMode && !state.hydrated) return;

        const byTitle = new Map<string, Objective[]>();
        state.objectives
          .filter(o => !o.archivedAt)
          .forEach(o => byTitle.set(o.title, [...(byTitle.get(o.title) ?? []), o]));

        const loserIds: string[] = [];
        byTitle.forEach((group, title) => {
          const known = group.filter(isUntouchedSeed);
          if (known.length < 2) return;
          const current = currentSeedFor(title);
          const keeper =
            // the wording this build ships, else the most recently seeded copy
            (current ? known.find(o => norm(o.body) === norm(current.body)) : undefined) ??
            [...known].sort((a, b) => b.createdAt - a.createdAt)[0];
          known.forEach(o => { if (o.id !== keeper.id) loserIds.push(o.id); });
        });

        if (loserIds.length === 0) return;

        const archivedAt = Date.now();
        const gone = new Set(loserIds);
        set(s2 => ({
          objectives: s2.objectives.map(o => (gone.has(o.id) ? { ...o, archivedAt } : o)),
        }));

        // One statement for the whole sweep: five separate updates gave five
        // separate chances to half-apply.
        queueOperation(
          set,
          get,
          { type: 'archive', table: 'objectives', objectiveIds: loserIds, data: { archived_at: archivedAt } },
          async () => {
            const user = await requireUser();
            const { error } = await supabase
              .from('objectives')
              .update({ archived_at: archivedAt })
              .in('id', loserIds)
              .eq('user_id', user.id);
            if (error) throw error;
          }
        );
      },

      addObjective: (title, color) => {
        const now = Date.now();
        const maxOrder = get().objectives.reduce((m, o) => Math.max(m, o.order), -1);
        const objective: Objective = {
          id: generateId(),
          title,
          essence: '',
          body: '',
          color,
          order: maxOrder + 1,
          createdAt: now,
          archivedAt: null,
        };
        set(state => ({ objectives: [...state.objectives, objective].sort(byOrder) }));

        queueOperation(set, get, { type: 'insert', table: 'objectives', data: mapToDb(objective) }, async () => {
          const user = await requireUser();
          const { error } = await supabase
            .from('objectives')
            .insert([{ ...mapToDb(objective), user_id: user.id }]);
          if (error) throw error;
        });
      },

      updateObjective: (id, updates) => {
        set(state => ({
          objectives: state.objectives.map(o => (o.id === id ? { ...o, ...updates } : o)).sort(byOrder),
        }));

        queueOperation(set, get, { type: 'update', table: 'objectives', objectiveId: id, data: mapToDb(updates) }, async () => {
          const user = await requireUser();
          const { error } = await supabase
            .from('objectives')
            .update(mapToDb(updates))
            .eq('id', id)
            .eq('user_id', user.id);
          if (error) throw error;
        });
      },

      removeObjective: (id) => {
        get().updateObjective(id, { archivedAt: Date.now() });
      },

      moveObjective: (id, direction) => {
        const active = get().objectives.filter(o => !o.archivedAt).sort(byOrder);
        const idx = active.findIndex(o => o.id === id);
        if (idx === -1) return;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= active.length) return;
        const a = active[idx];
        const b = active[swapIdx];
        get().updateObjective(a.id, { order: b.order });
        get().updateObjective(b.id, { order: a.order });
      },

      setGuestMode: (isGuest) => set({ guestMode: isGuest }),
      setError: (error) => set({ error }),

      processPendingOperations: async () => {
        if (!navigator.onLine) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const state = get();
        const remaining: PendingOperation[] = [];
        for (const op of state.pendingOperations) {
          try {
            if (op.type === 'insert') {
              const rows = (Array.isArray(op.data) ? op.data : [op.data])
                .map((d: any) => ({ ...d, user_id: user.id }));
              const { error } = await supabase
                .from('objectives')
                .upsert(rows, { onConflict: 'id' });
              if (error) throw error;
            } else if (op.type === 'archive') {
              const { error } = await supabase
                .from('objectives')
                .update({ archived_at: op.data.archived_at })
                .in('id', op.objectiveIds ?? [])
                .eq('user_id', user.id);
              if (error) throw error;
            } else if (op.type === 'update') {
              const { error } = await supabase
                .from('objectives')
                .update(op.data)
                .eq('id', op.objectiveId)
                .eq('user_id', user.id);
              if (error) throw error;
            }
          } catch (err) {
            console.warn('Failed to replay objective operation, will retry:', op.type, err);
            remaining.push(op);
          }
        }
        set({ pendingOperations: remaining });
      },
    }),
    {
      name: 'flowstate-objectives',
      partialize: (state) => ({
        objectives: state.objectives,
        pendingOperations: state.pendingOperations,
        guestMode: state.guestMode,
        seeded: state.seeded,
      }),
    }
  )
);
