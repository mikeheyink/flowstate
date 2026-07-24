import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Objective } from '../types';
import { supabase } from '../utils/supabase';

const generateId = () => Math.random().toString(36).substring(2, 9);

interface PendingOperation {
  id: string;
  type: 'insert' | 'update';
  table: string;
  data?: any;
  objectiveId?: string;
}

interface ObjectiveState {
  objectives: Objective[];
  isLoading: boolean;
  error: string | null;
  guestMode: boolean;
  seeded: boolean; // one-time default seed guard (per device)

  pendingOperations: PendingOperation[];

  fetchObjectives: () => Promise<void>;
  seedIfEmpty: () => void;
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
export const SEED_OBJECTIVES: Omit<Objective, 'id' | 'createdAt' | 'archivedAt'>[] = [
  {
    title: 'Peace',
    color: '#0EA5E9',
    order: 0,
    essence: 'Accept each moment as it is.',
    body: 'Increase my patient acceptance of every moment, so that peace is the baseline — not the reward.',
  },
  {
    title: 'Love',
    color: '#F43F5E',
    order: 1,
    essence: 'Show up fully for the people in my life.',
    body: 'Love my **immediate family**, **broader family**, **friends** and **colleagues**.',
  },
  {
    title: 'Health & Strength',
    color: '#10B981',
    order: 2,
    essence: 'Build a body ready for adventure.',
    body: 'Increase my health, strength and fitness.\n\n**Measurable goal:** enter one exciting event.\n- MUT?\n- Otter Trail?',
  },
  {
    title: 'Elite performance at Yellow',
    color: '#F59E0B',
    order: 3,
    essence: 'Elite performance — through others.',
    body: '- **A · Decisions & strategy** — decision quality, resource allocation, problem-solving, entrepreneurship and vision.\n- **B · Leadership** — help my team achieve their potential, thrive and be happy.\n- **C · Technology** — leverage it for better outcomes and execution.\n- **D · People** — attract and select the best; set them up for team success.\n- **E · Partners** — cultivate a strong external reputation; attract and retain the best.',
  },
  {
    title: 'Adventure',
    color: '#8B5CF6',
    order: 4,
    essence: 'Be a kid — plan something every day.',
    body: 'Get excited about every day. Plan adventures, big and small.\n\n- Weekly / monthly adventure-planning check-in.\n- Daily: “What is today’s adventure?”',
  },
];

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

export const useObjectiveStore = create<ObjectiveState>()(
  persist(
    (set, get) => ({
      objectives: [],
      isLoading: false,
      error: null,
      guestMode: false,
      seeded: false,
      pendingOperations: [],

      fetchObjectives: async () => {
        set({ isLoading: true });
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            set({ error: null, isLoading: false });
            return;
          }

          const { data, error } = await supabase
            .from('objectives')
            .select('*')
            .eq('user_id', user.id)
            .is('archived_at', null);
          if (error) throw error;

          const dbObjectives = (data || []).map(mapFromDb);

          // Reconcile local → DB (same pattern as habits): push up anything the
          // DB is missing via idempotent upserts, then merge.
          const local = get();
          const dbIds = new Set(dbObjectives.map(o => o.id));
          const localOnly = local.objectives.filter(o => !o.archivedAt && !dbIds.has(o.id));

          if (localOnly.length > 0) {
            const { error: upErr } = await supabase
              .from('objectives')
              .upsert(localOnly.map(o => ({ ...mapToDb(o), user_id: user.id })), { onConflict: 'id' });
            if (upErr) throw upErr;
          }

          set({ objectives: [...dbObjectives, ...localOnly].sort(byOrder), error: null });
        } catch (err: any) {
          set({ error: err.message });
        } finally {
          set({ isLoading: false });
          // Only seed after a fetch settled — never clobber a slow network with defaults.
          get().seedIfEmpty();
        }
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
        const now = Date.now();
        const seeds: Objective[] = SEED_OBJECTIVES.map((s, i) => ({
          ...s,
          id: generateId(),
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
              const { error } = await supabase
                .from('objectives')
                .upsert([{ ...op.data, user_id: user.id }], { onConflict: 'id' });
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
