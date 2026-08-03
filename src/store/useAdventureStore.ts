import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Adventure, AdventureCategory } from '../types';
import { supabase } from '../utils/supabase';

const generateId = () => Math.random().toString(36).substring(2, 9);

// The title a freshly-planted seed starts with. The editor pre-selects a title
// still equal to this, so typing replaces it rather than appending.
export const NEW_ADVENTURE_TITLE = 'New adventure';

type AdvTable = 'adventures' | 'adventure_categories';

interface PendingOperation {
  id: string;
  type: 'insert' | 'update';
  table: AdvTable;
  data?: any;
  rowId?: string;
}

interface AdventureState {
  adventures: Adventure[];
  categories: AdventureCategory[];
  isLoading: boolean;
  error: string | null;
  guestMode: boolean;
  seeded: boolean; // one-time default seed guard (per device)

  pendingOperations: PendingOperation[];

  fetchAdventures: () => Promise<void>;
  seedIfEmpty: () => void;

  addAdventure: (title?: string, init?: Partial<Adventure>) => string;
  updateAdventure: (id: string, updates: Partial<Adventure>) => void;
  removeAdventure: (id: string) => void; // soft-delete
  moveAdventure: (id: string, direction: 'up' | 'down') => void; // reorder within the Seedbed
  cycleCategory: (id: string) => string | null; // advance to the next category (fast keyboard tagging)

  addCategory: (label: string, color: string) => string;
  updateCategory: (id: string, updates: Partial<AdventureCategory>) => void;
  removeCategory: (id: string) => void;

  setGuestMode: (isGuest: boolean) => void;
  setError: (error: string | null) => void;
  processPendingOperations: () => Promise<void>;
}

// The starter palette — kinds of adventure. Editable in-app; stable slug ids so
// the seeded adventures below can reference them. Violet is the page's own
// accent (it matches the "Adventure" objective) and doubles as "Creative".
export const SEED_CATEGORIES: Omit<AdventureCategory, 'createdAt' | 'archivedAt'>[] = [
  { id: 'travel', label: 'Travel', color: '#0EA5E9', order: 0 },
  { id: 'outdoors', label: 'Outdoors', color: '#10B981', order: 1 },
  { id: 'social', label: 'Social', color: '#F43F5E', order: 2 },
  { id: 'creative', label: 'Creative', color: '#8B5CF6', order: 3 },
  { id: 'learning', label: 'Learning', color: '#F59E0B', order: 4 },
  { id: 'thrill', label: 'Thrill', color: '#EF4444', order: 5 },
  { id: 'culture', label: 'Culture', color: '#EC4899', order: 6 },
  { id: 'micro', label: 'Micro', color: '#14B8A6', order: 7 },
];

// Mike's real adventures — the initial content of the page. Editable in-app;
// a starting point, not a schema. `d` is [year, monthIndex, day]; null = a seed.
const SEED_ADVENTURES: { title: string; categoryId: string; d: [number, number, number] | null; notes?: string }[] = [
  // On the calendar (the Horizon)
  { title: 'China Trip', categoryId: 'travel', d: [2026, 6, 26] },
  { title: 'Erinvale Golf', categoryId: 'social', d: [2026, 7, 15] },
  { title: 'Wolseley Weekend', categoryId: 'outdoors', d: [2026, 8, 24] },
  { title: 'Pringle Bay Weekend', categoryId: 'outdoors', d: [2026, 9, 23] },
  { title: 'Drakensberg', categoryId: 'outdoors', d: [2026, 11, 20] },
  { title: 'Zimbali', categoryId: 'travel', d: [2026, 11, 23] },
  // Seeds (the Seedbed)
  { title: 'Japan Trip', categoryId: 'travel', d: null },
  { title: 'MUT George', categoryId: 'thrill', d: null },
  { title: 'Golf Tour', categoryId: 'social', d: null },
  { title: 'Onrus Trip', categoryId: 'travel', d: null },
  { title: 'Arabella Golf', categoryId: 'social', d: null, notes: 'Flook deal' },
];

const mapAdventureFromDb = (row: any): Adventure => ({
  id: row.id,
  title: row.title,
  notes: row.notes ?? '',
  categoryId: row.category_id ?? null,
  date: row.date != null ? parseInt(row.date) : null,
  lived: !!row.lived,
  externalEventId: row.external_event_id ?? null,
  order: row.order != null ? parseFloat(row.order) : 0,
  createdAt: parseInt(row.created_at),
  archivedAt: row.archived_at ? parseInt(row.archived_at) : null,
});

const mapAdventureToDb = (a: Partial<Adventure>) => {
  const o: any = {};
  if (a.id !== undefined) o.id = a.id;
  if (a.title !== undefined) o.title = a.title;
  if (a.notes !== undefined) o.notes = a.notes;
  if (a.categoryId !== undefined) o.category_id = a.categoryId;
  if (a.date !== undefined) o.date = a.date;
  if (a.lived !== undefined) o.lived = a.lived;
  if (a.externalEventId !== undefined) o.external_event_id = a.externalEventId;
  if (a.order !== undefined) o.order = a.order;
  if (a.createdAt !== undefined) o.created_at = a.createdAt;
  if (a.archivedAt !== undefined) o.archived_at = a.archivedAt;
  return o;
};

const mapCategoryFromDb = (row: any): AdventureCategory => ({
  id: row.id,
  label: row.label,
  color: row.color ?? '#8B5CF6',
  order: row.order != null ? parseFloat(row.order) : 0,
  createdAt: parseInt(row.created_at),
  archivedAt: row.archived_at ? parseInt(row.archived_at) : null,
});

const mapCategoryToDb = (c: Partial<AdventureCategory>) => {
  const o: any = {};
  if (c.id !== undefined) o.id = c.id;
  if (c.label !== undefined) o.label = c.label;
  if (c.color !== undefined) o.color = c.color;
  if (c.order !== undefined) o.order = c.order;
  if (c.createdAt !== undefined) o.created_at = c.createdAt;
  if (c.archivedAt !== undefined) o.archived_at = c.archivedAt;
  return o;
};

const requireUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated — deferring adventure write');
  return user;
};

// Same offline-tolerant write path as the objective/habit stores: try online,
// queue on failure, replay when connectivity/auth returns.
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
    console.warn('Adventure sync failed, queuing for retry:', operation.type, operation.table, err);
    set({ pendingOperations: [...state.pendingOperations, { ...operation, id: generateId() }] });
  }
};

const byOrder = (a: Adventure, b: Adventure) => a.order - b.order || a.createdAt - b.createdAt;
const catByOrder = (a: AdventureCategory, b: AdventureCategory) => a.order - b.order || a.createdAt - b.createdAt;

export const useAdventureStore = create<AdventureState>()(
  persist(
    (set, get) => ({
      adventures: [],
      categories: [],
      isLoading: false,
      error: null,
      guestMode: false,
      seeded: false,
      pendingOperations: [],

      fetchAdventures: async () => {
        set({ isLoading: true });
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            set({ error: null, isLoading: false });
            return;
          }

          const [advRes, catRes] = await Promise.all([
            supabase.from('adventures').select('*').eq('user_id', user.id).is('archived_at', null),
            supabase.from('adventure_categories').select('*').eq('user_id', user.id).is('archived_at', null),
          ]);
          if (advRes.error) throw advRes.error;
          if (catRes.error) throw catRes.error;

          const dbAdventures = (advRes.data || []).map(mapAdventureFromDb);
          const dbCategories = (catRes.data || []).map(mapCategoryFromDb);

          // Reconcile local → DB (same pattern as objectives): push up anything
          // the DB is missing via idempotent upserts, then merge.
          const local = get();
          const advIds = new Set(dbAdventures.map(a => a.id));
          const catIds = new Set(dbCategories.map(c => c.id));
          const advLocalOnly = local.adventures.filter(a => !a.archivedAt && !advIds.has(a.id));
          const catLocalOnly = local.categories.filter(c => !c.archivedAt && !catIds.has(c.id));

          if (advLocalOnly.length > 0) {
            const { error } = await supabase
              .from('adventures')
              .upsert(advLocalOnly.map(a => ({ ...mapAdventureToDb(a), user_id: user.id })), { onConflict: 'id' });
            if (error) throw error;
          }
          if (catLocalOnly.length > 0) {
            const { error } = await supabase
              .from('adventure_categories')
              .upsert(catLocalOnly.map(c => ({ ...mapCategoryToDb(c), user_id: user.id })), { onConflict: 'id' });
            if (error) throw error;
          }

          set({
            adventures: [...dbAdventures, ...advLocalOnly].sort(byOrder),
            categories: [...dbCategories, ...catLocalOnly].sort(catByOrder),
            error: null,
          });
        } catch (err: any) {
          set({ error: err.message });
        } finally {
          set({ isLoading: false });
          // Only seed after a fetch settled — never clobber a slow network.
          get().seedIfEmpty();
        }
      },

      // First run (per device): put the preset categories and Mike's adventures
      // on the page so it never opens empty. Guarded by `seeded` so deleting
      // them all stays deleted.
      seedIfEmpty: () => {
        const state = get();
        if (state.seeded) return;
        const hasContent =
          state.adventures.filter(a => !a.archivedAt).length > 0 ||
          state.categories.filter(c => !c.archivedAt).length > 0;
        if (hasContent) {
          set({ seeded: true });
          return;
        }

        const now = Date.now();
        const categories: AdventureCategory[] = SEED_CATEGORIES.map((c, i) => ({
          ...c,
          createdAt: now + i,
          archivedAt: null,
        }));
        const adventures: Adventure[] = SEED_ADVENTURES.map((a, i) => ({
          id: generateId(),
          title: a.title,
          notes: a.notes ?? '',
          categoryId: a.categoryId,
          date: a.d ? new Date(a.d[0], a.d[1], a.d[2], 12, 0, 0).getTime() : null,
          lived: false,
          externalEventId: null,
          order: i,
          createdAt: now + i,
          archivedAt: null,
        }));

        set({ categories, adventures, seeded: true });

        categories.forEach(c => {
          queueOperation(set, get, { type: 'insert', table: 'adventure_categories', data: mapCategoryToDb(c) }, async () => {
            const user = await requireUser();
            const { error } = await supabase
              .from('adventure_categories')
              .upsert([{ ...mapCategoryToDb(c), user_id: user.id }], { onConflict: 'id' });
            if (error) throw error;
          });
        });
        adventures.forEach(a => {
          queueOperation(set, get, { type: 'insert', table: 'adventures', data: mapAdventureToDb(a) }, async () => {
            const user = await requireUser();
            const { error } = await supabase
              .from('adventures')
              .upsert([{ ...mapAdventureToDb(a), user_id: user.id }], { onConflict: 'id' });
            if (error) throw error;
          });
        });
      },

      addAdventure: (title = NEW_ADVENTURE_TITLE, init = {}) => {
        const now = Date.now();
        const minOrder = get().adventures.reduce((m, a) => Math.min(m, a.order), 0);
        const adventure: Adventure = {
          id: generateId(),
          title,
          notes: '',
          categoryId: null,
          date: null,
          lived: false,
          externalEventId: null,
          order: minOrder - 1, // new seeds land at the top of the Seedbed
          createdAt: now,
          archivedAt: null,
          ...init,
        };
        set(state => ({ adventures: [...state.adventures, adventure].sort(byOrder) }));

        queueOperation(set, get, { type: 'insert', table: 'adventures', data: mapAdventureToDb(adventure) }, async () => {
          const user = await requireUser();
          const { error } = await supabase
            .from('adventures')
            .insert([{ ...mapAdventureToDb(adventure), user_id: user.id }]);
          if (error) throw error;
        });
        return adventure.id;
      },

      updateAdventure: (id, updates) => {
        set(state => ({
          adventures: state.adventures.map(a => (a.id === id ? { ...a, ...updates } : a)).sort(byOrder),
        }));

        queueOperation(set, get, { type: 'update', table: 'adventures', rowId: id, data: mapAdventureToDb(updates) }, async () => {
          const user = await requireUser();
          const { error } = await supabase
            .from('adventures')
            .update(mapAdventureToDb(updates))
            .eq('id', id)
            .eq('user_id', user.id);
          if (error) throw error;
        });
      },

      removeAdventure: (id) => {
        get().updateAdventure(id, { archivedAt: Date.now() });
      },

      moveAdventure: (id, direction) => {
        // Reorder within the Seedbed only (undated seeds); scheduled adventures
        // are ordered by their date, so reordering them is a no-op.
        const seeds = get().adventures
          .filter(a => !a.archivedAt && a.date == null && !a.lived)
          .sort(byOrder);
        const idx = seeds.findIndex(a => a.id === id);
        if (idx === -1) return;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= seeds.length) return;
        const a = seeds[idx];
        const b = seeds[swapIdx];
        get().updateAdventure(a.id, { order: b.order });
        get().updateAdventure(b.id, { order: a.order });
      },

      cycleCategory: (id) => {
        const cats = get().categories.filter(c => !c.archivedAt).sort(catByOrder);
        if (cats.length === 0) return null;
        const adv = get().adventures.find(a => a.id === id);
        if (!adv) return null;
        const curIdx = cats.findIndex(c => c.id === adv.categoryId);
        // Order: none → first → … → last → none
        let nextId: string | null;
        if (curIdx === -1) nextId = cats[0].id;
        else if (curIdx === cats.length - 1) nextId = null;
        else nextId = cats[curIdx + 1].id;
        get().updateAdventure(id, { categoryId: nextId });
        return nextId;
      },

      addCategory: (label, color) => {
        const now = Date.now();
        const maxOrder = get().categories.reduce((m, c) => Math.max(m, c.order), -1);
        const category: AdventureCategory = {
          id: generateId(),
          label,
          color,
          order: maxOrder + 1,
          createdAt: now,
          archivedAt: null,
        };
        set(state => ({ categories: [...state.categories, category].sort(catByOrder) }));

        queueOperation(set, get, { type: 'insert', table: 'adventure_categories', data: mapCategoryToDb(category) }, async () => {
          const user = await requireUser();
          const { error } = await supabase
            .from('adventure_categories')
            .insert([{ ...mapCategoryToDb(category), user_id: user.id }]);
          if (error) throw error;
        });
        return category.id;
      },

      updateCategory: (id, updates) => {
        set(state => ({
          categories: state.categories.map(c => (c.id === id ? { ...c, ...updates } : c)).sort(catByOrder),
        }));

        queueOperation(set, get, { type: 'update', table: 'adventure_categories', rowId: id, data: mapCategoryToDb(updates) }, async () => {
          const user = await requireUser();
          const { error } = await supabase
            .from('adventure_categories')
            .update(mapCategoryToDb(updates))
            .eq('id', id)
            .eq('user_id', user.id);
          if (error) throw error;
        });
      },

      removeCategory: (id) => {
        get().updateCategory(id, { archivedAt: Date.now() });
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
                .from(op.table)
                .upsert([{ ...op.data, user_id: user.id }], { onConflict: 'id' });
              if (error) throw error;
            } else if (op.type === 'update') {
              const { error } = await supabase
                .from(op.table)
                .update(op.data)
                .eq('id', op.rowId)
                .eq('user_id', user.id);
              if (error) throw error;
            }
          } catch (err) {
            console.warn('Failed to replay adventure operation, will retry:', op.type, op.table, err);
            remaining.push(op);
          }
        }
        set({ pendingOperations: remaining });
      },
    }),
    {
      name: 'flowstate-adventures',
      partialize: (state) => ({
        adventures: state.adventures,
        categories: state.categories,
        pendingOperations: state.pendingOperations,
        guestMode: state.guestMode,
        seeded: state.seeded,
      }),
    }
  )
);
