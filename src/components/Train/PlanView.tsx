import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Flag, Mountain } from 'lucide-react';
import { useTrainingStore } from '../../store/useTrainingStore';
import { useUIStore } from '../../store/useUIStore';
import { isGChordPending, isKeyConsumed } from '../../utils/keyChord';
import { toast } from '../Toaster';
import {
  WEEKS, MILESTONES, PHASES, RACE, SESSIONS, Week, Milestone,
  weekStart, weekOf, addDays, daysBetween, localDate,
} from '../../utils/trainingPlan';

/**
 * Plan — the road to the A-race. A countdown, the phase bar, and one
 * chronological list: each week with its focus, and the milestones that fall
 * inside it. ↑↓ move · ↵ open that week's sessions · X tick a milestone ·
 * T jump to this week.
 */

type Row = { kind: 'week'; week: Week } | { kind: 'milestone'; m: Milestone };

const fmtShort = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export function PlanView() {
  const milestonesDone = useTrainingStore((s) => s.milestonesDone);
  const { toggleMilestone, selectSession } = useTrainingStore.getState();
  const softStartActive = useUIStore((s) => s.softStartActive);
  const isAnyOverlayOpen = useUIStore((s) => s.isAnyOverlayOpen);

  const today = localDate();
  const thisWeek = weekOf(today);

  const rows = useMemo<Row[]>(() => WEEKS.flatMap((week): Row[] => {
    const start = weekStart(week.n);
    const end = addDays(start, 6);
    const ms = MILESTONES.filter(m => m.date >= start && m.date <= end);
    return [{ kind: 'week', week }, ...ms.map(m => ({ kind: 'milestone' as const, m }))];
  }), []);

  const currentRow = Math.max(0, rows.findIndex(r => r.kind === 'week' && r.week.n === thisWeek));
  const [cursor, setCursor] = useState(currentRow);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => { rowRefs.current[cursor]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [cursor]);

  const openWeek = (week: Week) => {
    const start = weekStart(week.n);
    const end = addDays(start, 6);
    const first = SESSIONS.find(s => s.date >= start && s.date <= end);
    if (!first) { toast(`Week ${week.n} sessions get written in the weekly check-in`); return; }
    selectSession(first.id);
    useUIStore.getState().setTrainTab('session');
  };

  const toggle = (m: Milestone) => {
    const wasDone = !!useTrainingStore.getState().milestonesDone[m.id];
    toggleMilestone(m.id);
    toast(wasDone ? 'Milestone reopened' : `${m.title} ✓`);
  };

  const handlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  handlerRef.current = (e: KeyboardEvent) => {
    if (softStartActive || isAnyOverlayOpen()) return;
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
    if (isKeyConsumed(e) || isGChordPending()) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const key = e.key.toLowerCase();
    const row = rows[cursor];
    if (key === 'arrowdown' || key === 'j') { e.preventDefault(); setCursor(c => Math.min(c + 1, rows.length - 1)); }
    else if (key === 'arrowup' || key === 'k') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (key === 't') { e.preventDefault(); setCursor(currentRow); }
    else if (key === 'enter' && row) { e.preventDefault(); row.kind === 'week' ? openWeek(row.week) : toggle(row.m); }
    else if (key === 'x' && row?.kind === 'milestone') { e.preventDefault(); toggle(row.m); }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => handlerRef.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const daysToRace = daysBetween(today, RACE.date);
  const nextMilestone = MILESTONES.find(m => !milestonesDone[m.id] && m.date >= today && !m.big)
    ?? MILESTONES.find(m => !milestonesDone[m.id] && !m.big);

  // Phase bar segments.
  const segments = useMemo(() => {
    const out: { phase: keyof typeof PHASES; weeks: number }[] = [];
    for (const w of WEEKS) {
      const last = out[out.length - 1];
      if (last && last.phase === w.phase) last.weeks++;
      else out.push({ phase: w.phase, weeks: 1 });
    }
    return out;
  }, []);
  const progress = Math.max(0, Math.min(1, (daysBetween(weekStart(1), today) + 0.5) / (WEEKS.length * 7)));

  let lastPhase: string | null = null;

  return (
    <div className="max-w-3xl mx-auto px-2 md:px-6 pb-32 pt-2">
      <h1 className="font-display text-lg font-semibold text-orange-500/80 dark:text-orange-400/80 tracking-wide uppercase mb-6">
        Plan
      </h1>

      {/* Countdown */}
      <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Mountain className="w-4 h-4" /> {RACE.name} · {fmtShort(RACE.date)} 2027
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-display text-6xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{daysToRace}</span>
            <span className="text-xl text-slate-500">days · week {Math.max(1, thisWeek)} of {WEEKS.length}</span>
          </div>
          <div className="mt-1 text-sm text-slate-500">{RACE.distance}</div>
        </div>
        {nextMilestone && (
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Next milestone</div>
            <div className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-200">{nextMilestone.title}</div>
            <div className="text-sm text-slate-500">{fmtShort(nextMilestone.date)} · in {Math.max(0, daysBetween(today, nextMilestone.date))} days</div>
          </div>
        )}
      </div>

      {/* Phase bar */}
      <div className="mb-10">
        <div className="relative flex h-2 rounded-full overflow-hidden">
          {segments.map((seg, i) => (
            <div key={i} style={{ flex: seg.weeks, backgroundColor: PHASES[seg.phase].color }} className="opacity-70" />
          ))}
        </div>
        <div className="relative h-0">
          <div className="absolute -top-3.5 w-0.5 h-5 bg-slate-900 dark:bg-white rounded" style={{ left: `${progress * 100}%` }} />
        </div>
        <div className="flex mt-2 text-[11px] text-slate-400">
          {segments.map((seg, i) => (
            <div key={i} style={{ flex: seg.weeks }} className="truncate pr-1">{PHASES[seg.phase].name}</div>
          ))}
        </div>
      </div>

      {/* Weeks + milestones */}
      <div>
        {rows.map((row, i) => {
          const isCur = i === cursor;
          if (row.kind === 'milestone') {
            const m = row.m;
            const done = !!milestonesDone[m.id];
            const overdue = !done && m.date < today;
            return (
              <div
                key={m.id}
                ref={(el) => { rowRefs.current[i] = el; }}
                onClick={() => { setCursor(i); toggle(m); }}
                className={`ml-6 my-1 flex items-start gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  isCur ? 'bg-white dark:bg-slate-800/80 ring-1 ring-slate-200 dark:ring-slate-700' : 'hover:bg-white/60 dark:hover:bg-slate-800/40'
                }`}
              >
                <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  done ? 'bg-success-500 text-white' : m.big ? 'bg-orange-500 text-white' : 'ring-1 ring-slate-300 dark:ring-slate-600 text-slate-400'
                }`}>
                  {done ? <Check className="w-3 h-3" /> : <Flag className="w-3 h-3" />}
                </span>
                <div className="min-w-0">
                  <div className={`font-semibold ${m.big ? 'text-lg text-orange-600 dark:text-orange-400' : 'text-slate-800 dark:text-slate-200'} ${done ? 'line-through opacity-60' : ''}`}>
                    {m.title}
                    <span className="ml-2 text-sm font-normal text-slate-400">{fmtShort(m.date)}</span>
                    {overdue && <span className="ml-2 text-xs font-medium text-amber-500">due</span>}
                  </div>
                  {(isCur || m.big) && <div className="text-sm text-slate-500 dark:text-slate-400">{m.detail}</div>}
                </div>
              </div>
            );
          }

          const w = row.week;
          const phase = PHASES[w.phase];
          const isNow = w.n === thisWeek;
          const isPast = w.n < thisWeek;
          const showPhase = w.phase !== lastPhase;
          lastPhase = w.phase;
          return (
            <React.Fragment key={`w${w.n}`}>
              {showPhase && (
                <div className="mt-8 mb-2 first:mt-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: phase.color }} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{phase.name}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400 max-w-2xl">{phase.why}</p>
                </div>
              )}
              <div
                ref={(el) => { rowRefs.current[i] = el; }}
                onClick={() => { setCursor(i); openWeek(w); }}
                className={`flex gap-4 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  isCur ? 'bg-white dark:bg-slate-800/80 ring-1 ring-slate-200 dark:ring-slate-700' : 'hover:bg-white/60 dark:hover:bg-slate-800/40'
                } ${isPast && !isCur ? 'opacity-50' : ''}`}
              >
                <div className="w-14 shrink-0 pt-0.5">
                  <div className={`text-sm font-semibold tabular-nums ${isNow ? 'text-orange-500' : 'text-slate-400'}`}>W{w.n}</div>
                  <div className="text-[11px] text-slate-400">{fmtShort(weekStart(w.n))}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {w.title}
                      {isNow && <span className="ml-2 text-[10px] uppercase tracking-wider text-orange-500">this week</span>}
                      {w.deload && <span className="ml-2 text-[10px] uppercase tracking-wider text-slate-400">deload</span>}
                    </span>
                    {w.km && <span className="text-sm text-slate-400 tabular-nums shrink-0">{w.km === 'race' ? 'race' : `${w.km} km`}</span>}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{w.focus}</p>
                  {(isCur || isNow) && (
                    <ul className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
                      {w.outline.map((o, j) => <li key={j}>· {o}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div className="hidden md:flex justify-center flex-wrap gap-4 mt-10 text-sm text-slate-400">
        {[['↑↓', 'move'], ['↵', 'open week / tick milestone'], ['X', 'tick milestone'], ['T', 'this week'], ['[ ]', 'session / plan'], ['U', 'undo']].map(([k, l]) => (
          <span key={k} className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium">{k}</kbd>{l}
          </span>
        ))}
      </div>
    </div>
  );
}
