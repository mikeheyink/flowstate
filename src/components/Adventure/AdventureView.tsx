import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Sprout, Mountain, History } from 'lucide-react';
import { useAdventureStore } from '../../store/useAdventureStore';
import { useUIStore } from '../../store/useUIStore';
import { Adventure, AdventureCategory } from '../../types';
import { toast } from '../Toaster';
import { isGChordPending, isKeyConsumed } from '../../utils/keyChord';
import { parseAdventureInput, parseDateEntry } from '../../utils/adventureInput';

/**
 * Adventure — the page that turns the "Adventure" objective into something
 * lived. Three zones, one dataset (Seed → Scheduled → Lived):
 *   · The Horizon   — scheduled adventures, grouped by month (your calendar).
 *   · The Seedbed   — undated seeds of future adventures.
 *   · Looking Back  — a quiet memory log (shown only once you've lived some).
 *
 * Entirely keyboard-driven, and modelled on the task list rather than a form:
 * everything edits in place, nothing opens an overlay. ↵ starts a new row and
 * you type straight into it — "Erinvale Golf 15 Aug" sets both the title and
 * the date, because the input is parsed with chrono the same way a task is.
 *
 * ↵ new · ↑↓ move · E edit · D date · C categorise · X lived · ⌘↑⌘↓ reorder
 */

// Colours offered when creating / recolouring a kind.
const PALETTE = ['#10B981', '#F43F5E', '#0EA5E9', '#F59E0B', '#8B5CF6', '#EF4444', '#EC4899', '#14B8A6', '#6674E4', '#F97316'];

const startOfToday = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };

const fmtDay = (ts: number) => new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
const fmtFull = (ts: number) => new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
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

type EditMode = 'title' | 'date';

export function AdventureView() {
  const adventures = useAdventureStore((s) => s.adventures);
  const categories = useAdventureStore((s) => s.categories);
  const addAdventure = useAdventureStore((s) => s.addAdventure);
  const updateAdventure = useAdventureStore((s) => s.updateAdventure);
  const removeAdventure = useAdventureStore((s) => s.removeAdventure);
  const moveAdventure = useAdventureStore((s) => s.moveAdventure);
  const cycleCategory = useAdventureStore((s) => s.cycleCategory);
  const seedIfEmpty = useAdventureStore((s) => s.seedIfEmpty);
  const migrateCategories = useAdventureStore((s) => s.migrateCategories);
  const pendingEditId = useAdventureStore((s) => s.pendingEditId);
  const setPendingEditId = useAdventureStore((s) => s.setPendingEditId);

  const softStartActive = useUIStore((s) => s.softStartActive);
  const isAnyOverlayOpen = useUIStore((s) => s.isAnyOverlayOpen);

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; mode: EditMode } | null>(null);
  const [showMemory, setShowMemory] = useState(false);
  const [editingKinds, setEditingKinds] = useState(false);
  const editingRef = useRef<{ id: string; mode: EditMode } | null>(null);
  useEffect(() => { editingRef.current = editing; }, [editing]);

  useEffect(() => { seedIfEmpty(); migrateCategories(); }, [seedIfEmpty, migrateCategories]);

  // A create from anywhere (↵, the Seed button, the FAB, the command palette)
  // lands here and opens the editor on the new row.
  useEffect(() => {
    if (!pendingEditId) return;
    setFocusedId(pendingEditId);
    setEditing({ id: pendingEditId, mode: 'title' });
    setPendingEditId(null);
  }, [pendingEditId, setPendingEditId]);

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

  const startNew = () => { addAdventure(); };

  // Closing the editor on a row that never got a title removes it, so ↵ then
  // Escape leaves nothing behind.
  const closeEditor = (id: string) => {
    setEditing(null);
    const a = useAdventureStore.getState().adventures.find(x => x.id === id);
    if (a && !a.title.trim()) removeAdventure(id);
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
      if (isCmd && key !== 'arrowup' && key !== 'arrowdown') return;

      const ids = navIds;
      const idx = ids.findIndex(id => id === focusedId);

      if (key === 'enter') {
        e.preventDefault();
        startNew();
      } else if (key === 'arrowdown') {
        e.preventDefault();
        if (isCmd && focusedId) { moveAdventure(focusedId, 'down'); return; }
        if (ids.length) setFocusedId(ids[idx < 0 ? 0 : Math.min(idx + 1, ids.length - 1)]);
      } else if (key === 'arrowup') {
        e.preventDefault();
        if (isCmd && focusedId) { moveAdventure(focusedId, 'up'); return; }
        if (ids.length) setFocusedId(ids[idx <= 0 ? ids.length - 1 : idx - 1]);
      } else if (key === 'e' && focusedId) {
        e.preventDefault();
        setEditing({ id: focusedId, mode: 'title' });
      } else if (key === 'd' && focusedId) {
        e.preventDefault();
        setEditing({ id: focusedId, mode: 'date' });
      } else if (key === 'c' && focusedId) {
        e.preventDefault();
        const next = cycleCategory(focusedId);
        const label = next
          ? (useAdventureStore.getState().categories.find(c => c.id === next)?.label ?? '')
          : 'Uncategorised';
        toast(label);
      } else if (key === 'x' && focusedId) {
        e.preventDefault();
        const a = useAdventureStore.getState().adventures.find(x => x.id === focusedId);
        if (a) { updateAdventure(focusedId, { lived: !a.lived }); toast(a.lived ? 'Back on the horizon' : 'Lived ✓'); }
      } else if ((key === 'delete' || key === 'backspace') && focusedId) {
        e.preventDefault();
        removeAdventure(focusedId);
        toast('Removed');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedId, navIds, softStartActive, isAnyOverlayOpen, moveAdventure, cycleCategory, updateAdventure, removeAdventure]);

  const rowProps = (a: Adventure) => ({
    key: a.id,
    adventure: a,
    category: a.categoryId ? catById.get(a.categoryId) : undefined,
    isFocused: focusedId === a.id,
    editMode: editing?.id === a.id ? editing.mode : null,
    onFocus: () => setFocusedId(a.id),
    onEdit: (mode: EditMode) => { setFocusedId(a.id); setEditing({ id: a.id, mode }); },
    onCloseEditor: () => closeEditor(a.id),
    onUpdate: (u: Partial<Adventure>) => updateAdventure(a.id, u),
  });

  return (
    <div className="max-w-2xl mx-auto px-6 pb-32 pt-4">
      {/* Heading — violet identity, distinct from the other pages */}
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="font-display text-lg font-semibold text-violet-500/80 dark:text-violet-400/80 tracking-wide uppercase">
          Adventure
        </h1>
        <button
          onClick={startNew}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          title="New adventure (↵)"
        >
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>
      <p className="text-sm text-slate-400 dark:text-slate-500 mb-10">Make each day a source of adventure.</p>

      {/* ── The Horizon — what's on the calendar ──────────────────────────── */}
      <Section icon={<Mountain className="w-3.5 h-3.5" />} title="The Horizon" count={horizon.length}>
        {horizon.length === 0 ? (
          <Empty>Nothing lined up. Press <Kbd>↵</Kbd> and type something like “Erinvale Golf 15 Aug”.</Empty>
        ) : (
          <div className="space-y-6">
            {horizon.map((a, i) => {
              const prev = horizon[i - 1];
              const newMonth = !prev || monthKey(prev.date!) !== monthKey(a.date!);
              return (
                <div key={a.id} className={newMonth ? '' : '-mt-6'}>
                  {newMonth && (
                    <div className="text-[11px] uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 ml-1">
                      {monthLabel(a.date!)}
                    </div>
                  )}
                  <AdventureRow {...rowProps(a)} />
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── The Seedbed — someday adventures ──────────────────────────────── */}
      <Section icon={<Sprout className="w-3.5 h-3.5" />} title="The Seedbed" count={seeds.length} className="mt-12">
        {seeds.length === 0 ? (
          <Empty>No seeds. Press <Kbd>↵</Kbd> to plant one.</Empty>
        ) : (
          <div className="space-y-0.5">
            {seeds.map(a => <AdventureRow {...rowProps(a)} />)}
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
            <div className="space-y-0.5 mt-3 opacity-80">
              {memory.map(a => <AdventureRow {...rowProps(a)} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Kinds — the editable legend (c cycles through these) ──────────── */}
      <KindsLegend editing={editingKinds} onToggleEditing={() => setEditingKinds(v => !v)} />

      <p className="mt-10 text-center text-[11px] text-slate-300 dark:text-slate-600 font-mono">
        ↵ new · ↑↓ move · E edit · D date · C kind · X lived · ⌘↑⌘↓ reorder
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

// ── One adventure row — reads as a line, edits in place ────────────────────
interface RowProps {
  adventure: Adventure;
  category?: AdventureCategory;
  isFocused: boolean;
  editMode: EditMode | null;
  onFocus: () => void;
  onEdit: (mode: EditMode) => void;
  onCloseEditor: () => void;
  onUpdate: (updates: Partial<Adventure>) => void;
}

function AdventureRow({ adventure, category, isFocused, editMode, onFocus, onEdit, onCloseEditor, onUpdate }: RowProps) {
  const accent = category?.color ?? '#94A3B8';
  const hint = adventure.date != null && !adventure.lived ? relativeHint(adventure.date) : null;

  return (
    <article
      onClick={onFocus}
      onDoubleClick={() => onEdit('title')}
      data-adventure-id={adventure.id}
      className={`group relative cursor-default rounded-xl transition-colors -mx-4 px-4 py-2 flex items-center gap-3 ${isFocused ? 'bg-white dark:bg-slate-850 ring-1 ring-slate-200/70 dark:ring-slate-800' : ''}`}
    >
      {isFocused && <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full" style={{ backgroundColor: accent }} />}
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: accent }}
        title={`${category?.label ?? 'Uncategorised'} — press C to change`}
      />

      {editMode === 'title' ? (
        <TitleEdit adventure={adventure} onUpdate={onUpdate} onClose={onCloseEditor} />
      ) : (
        <span className={`flex-1 min-w-0 truncate text-[15px] ${adventure.lived ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>
          {adventure.title}
          {adventure.notes && <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">· {adventure.notes.split('\n')[0]}</span>}
        </span>
      )}

      {editMode === 'date' ? (
        <DateEdit adventure={adventure} onUpdate={onUpdate} onClose={onCloseEditor} />
      ) : editMode === 'title' ? null : (
        <>
          {hint && <span className="text-[11px] text-violet-500/80 dark:text-violet-400/80 flex-shrink-0">{hint}</span>}
          {adventure.date != null && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit('date'); }}
              className="text-xs text-slate-400 dark:text-slate-500 tabular-nums flex-shrink-0 w-[68px] text-right hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title="Change date (D)"
            >
              {fmtDay(adventure.date)}
            </button>
          )}
        </>
      )}
    </article>
  );
}

/**
 * Title editing, task-list style: the text is replaced by a bare input. The
 * value is parsed on commit, so typing a date into the title moves the
 * adventure onto the Horizon — "Zimbali 23 Dec" sets both fields at once.
 */
function TitleEdit({ adventure, onUpdate, onClose }: { adventure: Adventure; onUpdate: (u: Partial<Adventure>) => void; onClose: () => void }) {
  const [val, setVal] = useState(adventure.title);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  const parsed = parseAdventureInput(val);
  const willSetDate = parsed.date != null && parsed.date !== adventure.date;

  const save = () => {
    const next: Partial<Adventure> = {};
    if (parsed.title) next.title = parsed.title;
    if (parsed.date != null) next.date = parsed.date;
    if (Object.keys(next).length) onUpdate(next);
    onClose();
  };

  return (
    <div className="flex-1 min-w-0 flex items-center gap-2">
      <input
        ref={ref}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') onClose();
          e.stopPropagation(); // the page's hotkeys must not fire while typing
        }}
        placeholder="Adventure — try “Erinvale Golf 15 Aug”"
        className="flex-1 min-w-0 bg-transparent text-[15px] outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600"
      />
      {/* Show what the date parser understood, so it's never a surprise. */}
      {willSetDate && (
        <span className="flex-shrink-0 text-[11px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400">
          {fmtFull(parsed.date!)}
        </span>
      )}
    </div>
  );
}

/** The `d` key — a bare inline date field, no overlay. Empty clears the date. */
function DateEdit({ adventure, onUpdate, onClose }: { adventure: Adventure; onUpdate: (u: Partial<Adventure>) => void; onClose: () => void }) {
  const [val, setVal] = useState(adventure.date != null ? fmtFull(adventure.date) : '');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  const parsed = parseDateEntry(val);

  const save = () => {
    // Blank means "back to a seed"; unparseable text leaves the date alone.
    if (!val.trim()) onUpdate({ date: null });
    else if (parsed != null) onUpdate({ date: parsed });
    onClose();
  };

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {parsed != null && (
        <span className="text-[11px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600 dark:text-violet-400">
          {fmtFull(parsed)}
        </span>
      )}
      <input
        ref={ref}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') onClose();
          e.stopPropagation();
        }}
        placeholder="next friday…"
        className="w-[132px] bg-transparent text-xs text-right outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 border-b border-violet-500/40 focus:border-violet-500 pb-0.5"
      />
    </div>
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
        <span className="text-[11px] uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Kinds <span className="normal-case tracking-normal text-slate-300 dark:text-slate-600">· C cycles</span>
        </span>
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
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); e.stopPropagation(); }}
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
