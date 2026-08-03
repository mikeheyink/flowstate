import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Sprout, Mountain, History, Check } from 'lucide-react';
import { useAdventureStore, NEW_ADVENTURE_TITLE } from '../../store/useAdventureStore';
import { useUIStore } from '../../store/useUIStore';
import { Adventure, AdventureCategory } from '../../types';
import { toast } from '../Toaster';
import { isGChordPending, isKeyConsumed } from '../../utils/keyChord';

/**
 * Adventure — the page that turns the "Adventure" objective into something
 * lived. Calm and keyboard-driven, like Objectives, but with its own violet
 * identity. Three zones, one dataset (Seed → Scheduled → Lived):
 *   · The Horizon   — scheduled adventures, grouped by month (your calendar).
 *   · The Seedbed   — undated seeds of future adventures.
 *   · Looking Back  — a quiet memory log (shown only once you've lived some).
 *
 * Keyboard: ↑↓ move · A add seed · E/↵ edit · P plant (date) · C categorise
 *           X lived · ⌘↑/⌘↓ reorder seeds.
 */

// Colours offered when creating / recolouring a kind.
const PALETTE = ['#0EA5E9', '#10B981', '#F43F5E', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6', '#6674E4', '#F97316'];


const pad = (n: number) => String(n).padStart(2, '0');
const startOfToday = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const toDateInput = (ts: number) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const fromDateInput = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12, 0, 0).getTime(); };

const fmtDay = (ts: number) => new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
const monthKey = (ts: number) => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()}`; };
const monthLabel = (ts: number) => {
  const d = new Date(ts);
  const base = d.toLocaleDateString(undefined, { month: 'long' });
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
};
const relativeHint = (ts: number): string | null => {
  const days = Math.round((new Date(ts).setHours(12, 0, 0, 0) - new Date().setHours(12, 0, 0, 0)) / 86400000);
  if (days < 0) return null;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 14) return `in ${days} days`;
  return null;
};

type Bucket = 'horizon' | 'seed' | 'memory';
const bucketOf = (a: Adventure): Bucket => {
  if (a.lived) return 'memory';
  if (a.date != null && a.date < startOfToday()) return 'memory';
  if (a.date != null) return 'horizon';
  return 'seed';
};

export function AdventureView() {
  const adventures = useAdventureStore((s) => s.adventures);
  const categories = useAdventureStore((s) => s.categories);
  const addAdventure = useAdventureStore((s) => s.addAdventure);
  const updateAdventure = useAdventureStore((s) => s.updateAdventure);
  const removeAdventure = useAdventureStore((s) => s.removeAdventure);
  const moveAdventure = useAdventureStore((s) => s.moveAdventure);
  const cycleCategory = useAdventureStore((s) => s.cycleCategory);
  const seedIfEmpty = useAdventureStore((s) => s.seedIfEmpty);

  const softStartActive = useUIStore((s) => s.softStartActive);
  const isAnyOverlayOpen = useUIStore((s) => s.isAnyOverlayOpen);

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editIntent, setEditIntent] = useState<'title' | 'date'>('title');
  const [showMemory, setShowMemory] = useState(false);
  const [editingKinds, setEditingKinds] = useState(false);
  const editingRef = useRef<string | null>(null);
  useEffect(() => { editingRef.current = editingId; }, [editingId]);

  useEffect(() => { seedIfEmpty(); }, [seedIfEmpty]);

  const catById = useMemo(() => {
    const m = new Map<string, AdventureCategory>();
    categories.filter(c => !c.archivedAt).forEach(c => m.set(c.id, c));
    return m;
  }, [categories]);

  const active = useMemo(() => adventures.filter(a => !a.archivedAt), [adventures]);
  const horizon = useMemo(
    () => active.filter(a => bucketOf(a) === 'horizon').sort((a, b) => (a.date! - b.date!)),
    [active]
  );
  const seeds = useMemo(
    () => active.filter(a => bucketOf(a) === 'seed').sort((a, b) => a.order - b.order || a.createdAt - b.createdAt),
    [active]
  );
  const memory = useMemo(
    () => active.filter(a => bucketOf(a) === 'memory').sort((a, b) => (b.date ?? b.createdAt) - (a.date ?? a.createdAt)),
    [active]
  );

  // Flat id list in display order — what ↑/↓ navigate over. Memory rows only
  // participate when the section is expanded.
  const navIds = useMemo(
    () => [...horizon, ...seeds, ...(showMemory ? memory : [])].map(a => a.id),
    [horizon, seeds, memory, showMemory]
  );

  // Horizon grouped by month for a clean itinerary feel.
  const horizonMonths = useMemo(() => {
    const groups: { key: string; label: string; items: Adventure[] }[] = [];
    for (const a of horizon) {
      const key = monthKey(a.date!);
      let g = groups.find(x => x.key === key);
      if (!g) { g = { key, label: monthLabel(a.date!), items: [] }; groups.push(g); }
      g.items.push(a);
    }
    return groups;
  }, [horizon]);

  const beginEdit = (id: string, intent: 'title' | 'date' = 'title') => {
    setFocusedId(id);
    setEditIntent(intent);
    setEditingId(id);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (softStartActive) return;
      if (isAnyOverlayOpen()) return;
      if (editingRef.current) return;
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      // A pending/resolving g-chord ("g a" → go to Adventure) owns the next key.
      if (isKeyConsumed(e) || isGChordPending()) return;

      const key = e.key.toLowerCase();
      const isCmd = e.metaKey || e.ctrlKey;
      const ids = navIds;
      if (ids.length === 0 && key !== 'a') return;
      const idx = ids.findIndex(id => id === focusedId);

      if (key === 'arrowdown') {
        e.preventDefault();
        if (isCmd && focusedId) { moveAdventure(focusedId, 'down'); return; }
        if (ids.length) setFocusedId(ids[idx < 0 ? 0 : Math.min(idx + 1, ids.length - 1)]);
      } else if (key === 'arrowup') {
        e.preventDefault();
        if (isCmd && focusedId) { moveAdventure(focusedId, 'up'); return; }
        if (ids.length) setFocusedId(ids[idx <= 0 ? ids.length - 1 : idx - 1]);
      } else if ((key === 'e' || key === 'enter') && focusedId && !isCmd) {
        e.preventDefault();
        beginEdit(focusedId, 'title');
      } else if (key === 'p' && focusedId && !isCmd) {
        e.preventDefault();
        beginEdit(focusedId, 'date');
      } else if (key === 'c' && focusedId && !isCmd) {
        e.preventDefault();
        const next = cycleCategory(focusedId);
        const label = next ? (useAdventureStore.getState().categories.find(c => c.id === next)?.label ?? '') : 'Uncategorised';
        toast(label);
      } else if (key === 'x' && focusedId && !isCmd) {
        e.preventDefault();
        const a = useAdventureStore.getState().adventures.find(x => x.id === focusedId);
        if (a) { updateAdventure(focusedId, { lived: !a.lived }); toast(a.lived ? 'Back on the horizon' : 'Lived ✓'); }
      } else if (key === 'a' && !isCmd) {
        e.preventDefault();
        const id = addAdventure();
        beginEdit(id, 'title');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedId, navIds, softStartActive, isAnyOverlayOpen, moveAdventure, addAdventure, cycleCategory, updateAdventure]);

  const activeCats = categories.filter(c => !c.archivedAt).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);

  return (
    <div className="max-w-2xl mx-auto px-6 pb-32 pt-4">
      {/* Heading — violet identity, distinct from the other pages */}
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="font-display text-lg font-semibold text-violet-500/80 dark:text-violet-400/80 tracking-wide uppercase">
          Adventure
        </h1>
        <button
          onClick={() => { const id = addAdventure(); beginEdit(id, 'title'); }}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          title="Plant a seed (A)"
        >
          <Plus className="w-3.5 h-3.5" /> Seed
        </button>
      </div>
      <p className="text-sm text-slate-400 dark:text-slate-500 mb-10">Make each day a source of adventure.</p>

      {/* ── The Horizon — what's on the calendar ──────────────────────────── */}
      <Section icon={<Mountain className="w-3.5 h-3.5" />} title="The Horizon" count={horizon.length}>
        {horizon.length === 0 ? (
          <Empty>Nothing lined up yet. Plant a seed, then press <Kbd>P</Kbd> to give it a date.</Empty>
        ) : (
          <div className="space-y-6">
            {horizonMonths.map(group => (
              <div key={group.key}>
                <div className="text-[11px] uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 ml-1">{group.label}</div>
                <div className="space-y-1">
                  {group.items.map(a => (
                    <AdventureRow
                      key={a.id}
                      adventure={a}
                      category={a.categoryId ? catById.get(a.categoryId) : undefined}
                      categories={activeCats}
                      isFocused={focusedId === a.id}
                      isEditing={editingId === a.id}
                      editIntent={editIntent}
                      onFocus={() => setFocusedId(a.id)}
                      onEdit={() => beginEdit(a.id, 'title')}
                      onDoneEditing={() => setEditingId(null)}
                      onUpdate={(u) => updateAdventure(a.id, u)}
                      onRemove={() => { if (confirm(`Remove “${a.title}”?`)) removeAdventure(a.id); }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── The Seedbed — someday adventures ──────────────────────────────── */}
      <Section icon={<Sprout className="w-3.5 h-3.5" />} title="The Seedbed" count={seeds.length} className="mt-12">
        {seeds.length === 0 ? (
          <Empty>No seeds. Press <Kbd>A</Kbd> to plant one.</Empty>
        ) : (
          <div className="space-y-1">
            {seeds.map(a => (
              <AdventureRow
                key={a.id}
                adventure={a}
                category={a.categoryId ? catById.get(a.categoryId) : undefined}
                categories={activeCats}
                isFocused={focusedId === a.id}
                isEditing={editingId === a.id}
                editIntent={editIntent}
                onFocus={() => setFocusedId(a.id)}
                onEdit={() => beginEdit(a.id, 'title')}
                onDoneEditing={() => setEditingId(null)}
                onUpdate={(u) => updateAdventure(a.id, u)}
                onRemove={() => { if (confirm(`Remove “${a.title}”?`)) removeAdventure(a.id); }}
              />
            ))}
          </div>
        )}
      </Section>

      {/* ── Looking Back — the memory log (only once there's something) ────── */}
      {memory.length > 0 && (
        <div className="mt-12">
          <button
            onClick={() => setShowMemory(v => !v)}
            className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <History className="w-3.5 h-3.5" />
            Looking Back
            <span className="text-slate-300 dark:text-slate-600">{memory.length}</span>
            <span className="text-slate-300 dark:text-slate-600">{showMemory ? '–' : '+'}</span>
          </button>
          {showMemory && (
            <div className="space-y-1 mt-3 opacity-80">
              {memory.map(a => (
                <AdventureRow
                  key={a.id}
                  adventure={a}
                  category={a.categoryId ? catById.get(a.categoryId) : undefined}
                  categories={activeCats}
                  isFocused={focusedId === a.id}
                  isEditing={editingId === a.id}
                  editIntent={editIntent}
                  onFocus={() => setFocusedId(a.id)}
                  onEdit={() => beginEdit(a.id, 'title')}
                  onDoneEditing={() => setEditingId(null)}
                  onUpdate={(u) => updateAdventure(a.id, u)}
                  onRemove={() => { if (confirm(`Remove “${a.title}”?`)) removeAdventure(a.id); }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Kinds — the editable category legend ──────────────────────────── */}
      <KindsLegend editing={editingKinds} onToggleEditing={() => setEditingKinds(v => !v)} />

      <p className="mt-10 text-center text-[11px] text-slate-300 dark:text-slate-600 font-mono">
        ↑↓ move · A seed · P plant · C categorise · X lived · E edit
      </p>
    </div>
  );
}

// ── Small presentational helpers ──────────────────────────────────────────
function Section({ icon, title, count, className = '', children }: { icon: React.ReactNode; title: string; count: number; className?: string; children: React.ReactNode }) {
  return (
    <section className={className}>
      <div className="flex items-center gap-2 mb-3 text-slate-400 dark:text-slate-500">
        {icon}
        <h2 className="text-[11px] uppercase tracking-widest font-semibold">{title}</h2>
        <span className="text-slate-300 dark:text-slate-600">{count}</span>
      </div>
      {children}
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-slate-400 dark:text-slate-500 ml-1 py-2">{children}</p>
);
const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="px-1 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">{children}</kbd>
);

// ── One adventure row (read + inline edit) ─────────────────────────────────
interface RowProps {
  adventure: Adventure;
  category?: AdventureCategory;
  categories: AdventureCategory[];
  isFocused: boolean;
  isEditing: boolean;
  editIntent: 'title' | 'date';
  onFocus: () => void;
  onEdit: () => void;
  onDoneEditing: () => void;
  onUpdate: (updates: Partial<Adventure>) => void;
  onRemove: () => void;
}

function AdventureRow({ adventure, category, categories, isFocused, isEditing, editIntent, onFocus, onEdit, onDoneEditing, onUpdate, onRemove }: RowProps) {
  const [title, setTitle] = useState(adventure.title);
  const [notes, setNotes] = useState(adventure.notes);
  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const accent = category?.color ?? '#94A3B8';
  const hint = adventure.date != null && !adventure.lived ? relativeHint(adventure.date) : null;

  useEffect(() => {
    if (isEditing) {
      setTitle(adventure.title);
      setNotes(adventure.notes);
      setTimeout(() => {
        if (editIntent === 'date') { dateRef.current?.focus(); return; }
        titleRef.current?.focus();
        // A brand-new seed still holding the placeholder: select it so the first
        // thing typed becomes the title instead of appending to it.
        if (adventure.title === NEW_ADVENTURE_TITLE) titleRef.current?.select();
      }, 30);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const commit = () => {
    onUpdate({ title: title.trim() || adventure.title, notes: notes.trim() });
    onDoneEditing();
  };

  if (isEditing) {
    return (
      <div className="rounded-xl ring-1 ring-violet-500/40 bg-white dark:bg-slate-850 p-4 -mx-4">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Adventure"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); commit(); } }}
            className="flex-1 bg-transparent font-display text-lg font-semibold text-slate-900 dark:text-slate-100 outline-none"
          />
        </div>

        {/* Date — "planting" a seed onto the calendar */}
        <div className="flex items-center gap-2 mb-3 ml-[22px]">
          <input
            ref={dateRef}
            type="date"
            value={adventure.date != null ? toDateInput(adventure.date) : ''}
            onChange={(e) => onUpdate({ date: e.target.value ? fromDateInput(e.target.value) : null })}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); commit(); } }}
            className="bg-transparent text-sm text-slate-600 dark:text-slate-300 outline-none border-b border-slate-200 dark:border-slate-700 focus:border-violet-500 pb-0.5"
          />
          {adventure.date != null && (
            <button onClick={() => onUpdate({ date: null })} className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">back to seed</button>
          )}
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3 ml-[22px]">
          {categories.map(c => {
            const on = adventure.categoryId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => onUpdate({ categoryId: on ? null : c.id })}
                className={`flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-full text-xs transition-all ${on ? 'ring-1' : 'opacity-60 hover:opacity-100'}`}
                style={on ? { backgroundColor: `${c.color}1A`, color: c.color, boxShadow: `inset 0 0 0 1px ${c.color}66` } : {}}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.label}
              </button>
            );
          })}
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); commit(); } }}
          rows={Math.max(1, notes.split('\n').length)}
          placeholder="Notes (optional)"
          className="w-full bg-transparent text-sm leading-relaxed text-slate-600 dark:text-slate-300 outline-none resize-y ml-[22px]"
        />

        <div className="flex items-center justify-between mt-3 ml-[22px]">
          <button
            onClick={() => onUpdate({ lived: !adventure.lived })}
            className={`flex items-center gap-1 text-xs transition-colors ${adventure.lived ? 'text-success-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
          >
            <Check className="w-3.5 h-3.5" /> {adventure.lived ? 'Lived' : 'Mark lived'}
          </button>
          <div className="flex items-center gap-3 text-xs">
            <button onClick={onRemove} className="text-slate-400 hover:text-red-500 transition-colors">Remove</button>
            <button onClick={commit} className="px-2.5 py-1 rounded-md bg-violet-600 text-white hover:bg-violet-500 font-medium">Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <article
      onClick={onFocus}
      onDoubleClick={onEdit}
      data-adventure-id={adventure.id}
      className={`group relative cursor-default rounded-xl transition-colors -mx-4 px-4 py-2 flex items-center gap-3 ${isFocused ? 'bg-white dark:bg-slate-850 ring-1 ring-slate-200/70 dark:ring-slate-800' : ''}`}
    >
      {isFocused && <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full" style={{ backgroundColor: accent }} />}
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} title={category?.label ?? 'Uncategorised'} />
      <span className={`flex-1 min-w-0 truncate text-[15px] ${adventure.lived ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>
        {adventure.title}
        {adventure.notes && <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">· {adventure.notes.split('\n')[0]}</span>}
      </span>
      {hint && <span className="text-[11px] text-violet-500/80 dark:text-violet-400/80 flex-shrink-0">{hint}</span>}
      {adventure.date != null && (
        <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums flex-shrink-0 w-[68px] text-right">{fmtDay(adventure.date)}</span>
      )}
    </article>
  );
}

// ── Editable "kinds" legend ────────────────────────────────────────────────
function KindsLegend({ editing, onToggleEditing }: { editing: boolean; onToggleEditing: () => void }) {
  const categories = useAdventureStore((s) => s.categories);
  const addCategory = useAdventureStore((s) => s.addCategory);
  const updateCategory = useAdventureStore((s) => s.updateCategory);
  const removeCategory = useAdventureStore((s) => s.removeCategory);
  const cats = categories.filter(c => !c.archivedAt).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);

  return (
    <div className="mt-12 pt-6 border-t border-slate-100 dark:border-slate-800/60">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-widest text-slate-400 dark:text-slate-500">Kinds</span>
        <button onClick={onToggleEditing} className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>

      {!editing ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {cats.map(c => (
            <span key={c.id} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
              {c.label}
            </span>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {cats.map(c => (
            <div key={c.id} className="flex items-center gap-2">
              <button
                onClick={() => { const i = PALETTE.indexOf(c.color); updateCategory(c.id, { color: PALETTE[(i + 1) % PALETTE.length] }); }}
                className="w-4 h-4 rounded-full flex-shrink-0 transition-transform hover:scale-125"
                style={{ backgroundColor: c.color }}
                title="Cycle colour"
              />
              <input
                defaultValue={c.label}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.label) updateCategory(c.id, { label: v }); }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-200 outline-none border-b border-transparent focus:border-violet-500 pb-0.5"
              />
              <button onClick={() => removeCategory(c.id)} className="text-[11px] text-slate-400 hover:text-red-500 transition-colors">Remove</button>
            </div>
          ))}
          <button
            onClick={() => addCategory('New kind', PALETTE[cats.length % PALETTE.length])}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors mt-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add kind
          </button>
        </div>
      )}
    </div>
  );
}
