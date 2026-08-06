import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Adventure, AdventureCategory } from '../types';
import { supabase } from '../utils/supabase';

const generateId = () => Math.random().toString(36).substring(2, 9);


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
  categorySeedVersion: number; // which kinds preset this device has

  // Set by every "create" path (Enter, the Seed button, the FAB, the palette) so
  // the page opens the inline editor on the new row wherever it was triggered.
  pendingEditId: string | null;
  setPendingEditId: (id: string | null) => void;

  pendingOperations: PendingOperation[];

  fetchAdventures: () => Promise<void>;
  seedIfEmpty: () => void;
  migrateCategories: () => void;

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

// The kinds of adventure. Editable in-app; stable slug ids so the seeded
// adventures below can reference them. Deliberately few — `c` cycles through
// them, so every extra kind is another keypress.
export const SEED_CATEGORIES: Omit<AdventureCategory, 'createdAt' | 'archivedAt'>[] = [
  { id: 'golf', label: 'Golf', color: '#10B981', order: 0 },
  { id: 'family', label: 'Family', color: '#F43F5E', order: 1 },
  { id: 'travel', label: 'Travel', color: '#0EA5E9', order: 2 },
  { id: 'trailrun', label: 'Trail Run', color: '#F59E0B', order: 3 },
  { id: 'other', label: 'Other', color: '#8B5CF6', order: 4 },
];

// The first release shipped eight kinds. This maps them onto the five above so
// devices that already seeded keep their tags instead of silently losing them.
// Bump CATEGORY_SEED_VERSION whenever the preset changes again.
export const CATEGORY_SEED_VERSION = 2;
const LEGACY_CATEGORY_MAP: Record<string, string> = {
  travel: 'travel',
  outdoors: 'family',
  social: 'golf',
  creative: 'other',
  learning: 'other',
  thrill: 'trailrun',
  culture: 'other',
  micro: 'other',
};

// Mike's real adventures — the initial content of the page. Editable in-app;
// a starting point, not a schema. `d` is [year, monthIndex, day]; null = a seed.
const SEED_ADVENTURES: { title: string; categoryId: string; d: [number, number, number] | null; notes?: string }[] = [
  // On the calendar (the Horizon)
  { title: 'China Trip', categoryId: 'travel', d: [2026, 6, 26] },
  { title: 'Erinvale Golf', categoryId: 'golf', d: [2026, 7, 15] },
  { title: 'Wolseley Weekend', categoryId: 'family', d: [2026, 8, 24] },
  { title: 'Pringle Bay Weekend', categoryId: 'family', d: [2026, 9, 23] },
  { title: 'Drakensberg', categoryId: 'travel', d: [2026, 11, 20] },
  { title: 'Zimbali', categoryId: 'travel', d: [2026, 11, 23] },
  // Seeds (the Seedbed)
  { title: 'Japan Trip', categoryId: 'travel', d: null },
  { title: 'MUT George', categoryId: 'trailrun', d: null },
  { title: 'Golf Tour', categoryId: 'golf', d: null },
  { title: 'Onrus Trip', categoryId: 'family', d: null },
  { title: 'Arabella Golf', categoryId: 'golf', d: null, notes: 'Flook deal' },
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
      // Starts at 1, not the current version: a device that seeded the first
      // release has no persisted value, and zustand's shallow merge would let a
      // current-version default here silently skip the migration. seedIfEmpty
      // stamps the current version for genuinely fresh devices.
      categorySeedVersion: 1,
      pendingEditId: null,
      setPendingEditId: (id) => set({ pendingEditId: id }),
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
          get().migrateCategories();
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
          return; // leave categorySeedVersion alone — migrateCategories owns it
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

        // A genuinely fresh device gets the current preset, so there's nothing
        // for migrateCategories to do.
        set({ categories, adventures, seeded: true, categorySeedVersion: CATEGORY_SEED_VERSION });

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

      // Replace the first release's eight kinds with the current five, carrying
       // each adventure's tag across via LEGACY_CATEGORY_MAP. Runs once per
      // device (guarded by categorySeedVersion) and leaves any kind the user
      // added themselves untouched.
      migrateCategories: () => {
        const state = get();
        if (state.categorySeedVersion >= CATEGORY_SEED_VERSION) return;
        if (!state.seeded) { set({ categorySeedVersion: CATEGORY_SEED_VERSION }); return; }

        const legacyIds = new Set(Object.keys(LEGACY_CATEGORY_MAP));
        const existing = state.categories.filter(c => !c.archivedAt);
        const custom = existing.filter(c => !legacyIds.has(c.id));

        const now = Date.now();
        const fresh: AdventureCategory[] = SEED_CATEGORIES.map((c, i) => ({
          ...c,
          createdAt: now + i,
          archivedAt: null,
        }));
        // Any kind the user made keeps its identity, ordered after the preset.
        const kept = custom.map((c, i) => ({ ...c, order: fresh.length + i }));

        set({
          categories: [...fresh, ...kept],
          categorySeedVersion: CATEGORY_SEED_VERSION,
        });

        // Re-tag adventures that pointed at a retired kind.
        state.adventures.forEach(a => {
          if (a.categoryId && legacyIds.has(a.categoryId)) {
            get().updateAdventure(a.id, { categoryId: LEGACY_CATEGORY_MAP[a.categoryId] });
          }
        });

        // Retire the old rows server-side, and push the new ones up. Skip ids
        // the new preset reuses ('travel') — archiving by id would archive the
        // fresh row we just installed under that same id.
        const freshIds = new Set(fresh.map(c => c.id));
        existing
          .filter(c => legacyIds.has(c.id) && !freshIds.has(c.id))
          .forEach(c => { get().updateCategory(c.id, { archivedAt: now }); });
        fresh.forEach(c => {
          queueOperation(set, get, { type: 'insert', table: 'adventure_categories', data: mapCategoryToDb(c) }, async () => {
            const user = await requireUser();
            const { error } = await supabase
              .from('adventure_categories')
              .upsert([{ ...mapCategoryToDb(c), user_id: user.id }], { onConflict: 'id' });
            if (error) throw error;
          });
        });
      },

      addAdventure: (title = '', init = {}) => {
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
        set(state => ({
          adventures: [...state.adventures, adventure].sort(byOrder),
          pendingEditId: adventure.id, // the page opens the inline editor on it
        }));

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
      // pendingEditId is deliberately transient — a refresh shouldn't reopen an
      // editor on a row you created earlier.
      partialize: (state) => ({
        adventures: state.adventures,
        categories: state.categories,
        pendingOperations: state.pendingOperations,
        guestMode: state.guestMode,
        seeded: state.seeded,
        categorySeedVersion: state.categorySeedVersion,
      }),
    }
  )
);
