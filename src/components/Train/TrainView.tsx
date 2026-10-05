import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, Play, Pause, BookOpen, Video } from 'lucide-react';
import { useTrainingStore } from '../../store/useTrainingStore';
import { useUIStore } from '../../store/useUIStore';
import { isGChordPending, isKeyConsumed } from '../../utils/keyChord';
import { toast } from '../Toaster';
import { PlanView } from './PlanView';
import {
  SESSIONS, Session, Step, flattenSession, roundsFor, describeRx, fmtClock,
  defaultSessionIndex, localDate,
} from '../../utils/trainingPlan';

/**
 * Train — plays the week's sessions. Three screens, one keyboard model:
 *   · Overview — the session at a glance. , . change day, ↑↓ pick, → / ↵ start.
 *   · Plan     — [ ] flips to the weeks + milestones view (PlanView).
 *   · Player   — one exercise, big. Space ticks a set / starts the timer,
 *                X done + next, ← → move, V (or ↵) video + cues, U / ⌘Z undo, Esc out.
 *   · Finish   — a note for the log, ↵ to save.
 * Space alone can carry you through a whole session: set → rest → set → next.
 */

// ---------------------------------------------------------------------------
// Sound — short beeps for timer ends. Created lazily on a key press so the
// browser's autoplay policy is satisfied.
// ---------------------------------------------------------------------------
let audioCtx: AudioContext | null = null;
function beep(freq = 880, ms = 160, times = 1) {
  try {
    audioCtx = audioCtx ?? new AudioContext();
    for (let i = 0; i < times; i++) {
      const t0 = audioCtx.currentTime + i * (ms / 1000 + 0.08);
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + ms / 1000 + 0.02);
    }
  } catch { /* no audio — the visual timer still works */ }
}

type Timer = { kind: 'hold' | 'rest'; total: number; endsAt: number | null; remaining: number };

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
const longDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

export function TrainView() {
  const logs = useTrainingStore((s) => s.logs);
  const active = useTrainingStore((s) => s.active);
  const selectedSessionId = useTrainingStore((s) => s.selectedSessionId);
  const { selectSession, start, goToStep, setRoundsDone, exit, complete, uncomplete, undo } = useTrainingStore.getState();

  const softStartActive = useUIStore((s) => s.softStartActive);
  const isAnyOverlayOpen = useUIStore((s) => s.isAnyOverlayOpen);
  const trainTab = useUIStore((s) => s.trainTab);

  const sessionIdx = useMemo(() => {
    const i = SESSIONS.findIndex(s => s.id === selectedSessionId);
    return i >= 0 ? i : defaultSessionIndex(SESSIONS);
  }, [selectedSessionId]);
  const session = SESSIONS[sessionIdx];
  const steps = useMemo(() => flattenSession(session), [session]);

  const playing = active && active.sessionId === session.id ? active : null;
  const stepIdx = playing ? Math.min(playing.stepIdx, steps.length) : -1;
  const screen: 'overview' | 'player' | 'finish' = !playing ? 'overview' : stepIdx >= steps.length ? 'finish' : 'player';

  // Overview cursor — which exercise ↵ starts from.
  const [cursor, setCursor] = useState(0);
  useEffect(() => { setCursor(0); }, [session.id]);

  const [howTo, setHowTo] = useState(false);
  const [videoPaused, setVideoPaused] = useState(false);
  const [timer, setTimer] = useState<Timer | null>(null);
  const [, setTick] = useState(0);
  const [note, setNote] = useState('');
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Changing exercise cancels any running timer.
  useEffect(() => { setTimer(null); setVideoPaused(false); }, [stepIdx, session.id]);
  useEffect(() => { setHowTo(false); }, [screen]);
  useEffect(() => { setNote(logs[session.id]?.note ?? ''); }, [session.id, screen]); // eslint-disable-line react-hooks/exhaustive-deps

  const step: Step | null = screen === 'player' ? steps[stepIdx] : null;
  const rounds = step ? roundsFor(step.rx) : [];
  // The how-to opens on the current exercise, or the highlighted one in the overview.
  const howToStep: Step | null = screen === 'player' ? step : screen === 'overview' ? steps[cursor] ?? null : null;
  const done = playing && step ? Math.min(playing.roundsDone[stepIdx] ?? 0, rounds.length) : 0;

  const remaining = timer
    ? (timer.endsAt ? (timer.endsAt - Date.now()) / 1000 : timer.remaining)
    : 0;

  // Tick + timer completion.
  useEffect(() => {
    if (!timer?.endsAt) return;
    const id = window.setInterval(() => {
      const left = (timer.endsAt! - Date.now()) / 1000;
      if (left <= 0) {
        window.clearInterval(id);
        if (timer.kind === 'rest') {
          beep(660, 140, 2);
          setTimer(null);
          return;
        }
        // Hold finished: tick the round, then rest (unless switching sides).
        beep(880, 300);
        const st = useTrainingStore.getState().active;
        if (!st || !step) return;
        const n = Math.min((st.roundsDone[stepIdx] ?? 0) + 1, rounds.length);
        setRoundsDone(stepIdx, n);
        const sideSwitch = step.rx.perSide && n % 2 === 1;
        if (n < rounds.length && !sideSwitch && step.rx.rest) {
          setTimer({ kind: 'rest', total: step.rx.rest, endsAt: Date.now() + step.rx.rest * 1000, remaining: step.rx.rest });
        } else {
          setTimer(null);
        }
        return;
      }
      setTick(t => t + 1);
    }, 200);
    return () => window.clearInterval(id);
  }, [timer, step, stepIdx, rounds.length, setRoundsDone]);

  const videoCommand = (func: 'playVideo' | 'pauseVideo') => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
  };

  const goStep = (i: number) => {
    if (i < 0) { exit(); return; }
    goToStep(Math.min(i, steps.length));
  };

  // The one "do the next thing" action — Space, or the big button.
  const advance = () => {
    if (!step) return;
    if (timer?.kind === 'rest') { setTimer(null); return; }
    if (done >= rounds.length) { goStep(stepIdx + 1); return; }
    if (step.rx.hold) {
      if (timer?.kind === 'hold') {
        setTimer(timer.endsAt
          ? { ...timer, endsAt: null, remaining: (timer.endsAt - Date.now()) / 1000 }
          : { ...timer, endsAt: Date.now() + timer.remaining * 1000 });
      } else {
        setTimer({ kind: 'hold', total: step.rx.hold, endsAt: Date.now() + step.rx.hold * 1000, remaining: step.rx.hold });
      }
      return;
    }
    const n = done + 1;
    setRoundsDone(stepIdx, n);
    if (n < rounds.length && step.rx.rest) {
      setTimer({ kind: 'rest', total: step.rx.rest, endsAt: Date.now() + step.rx.rest * 1000, remaining: step.rx.rest });
    }
  };

  // X — call the exercise done (even mid-timer) and move on.
  const markDoneAndNext = () => {
    if (!step) return;
    setTimer(null);
    if (done < rounds.length) setRoundsDone(stepIdx, rounds.length);
    goStep(stepIdx + 1);
  };

  const doUndo = () => {
    setTimer(null);
    toast(undo() ? 'Undone' : 'Nothing to undo');
  };

  const replayVideo = () => {
    const v = howToStep?.exercise.video;
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [v?.start ?? 0, true] }), '*');
    videoCommand('playVideo');
    setVideoPaused(false);
  };

  const save = () => {
    complete(session.id, note);
    setNote('');
    toast('Session logged ✓');
  };

  // Keyboard — one handler, branching on screen. Reads through a ref so it is
  // never stale and never re-registers mid-press.
  const handlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  handlerRef.current = (e: KeyboardEvent) => {
    if (softStartActive || isAnyOverlayOpen()) return;
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
    if (isKeyConsumed(e) || isGChordPending()) return;
    const key = e.code === 'Space' ? ' ' : e.key.toLowerCase();

    // Undo — ⌘Z (the app-wide habit), U, or ⌫. Works on every screen.
    if ((e.metaKey || e.ctrlKey) && key === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (key === 'u' || key === 'backspace') { e.preventDefault(); doUndo(); return; }
    if (trainTab === 'plan') return; // PlanView owns the rest

    // How-to panel (from the overview or the player) owns the keys while open.
    if (howTo) {
      if (key === 'escape' || key === 'enter' || key === 'v') { e.preventDefault(); setHowTo(false); }
      else if (key === ' ') {
        e.preventDefault();
        videoCommand(videoPaused ? 'playVideo' : 'pauseVideo');
        setVideoPaused(p => !p);
      }
      else if (key === 'r') { e.preventDefault(); replayVideo(); }
      else if (key === 'arrowright' || key === 'arrowleft') {
        e.preventDefault();
        const d = key === 'arrowright' ? 1 : -1;
        if (screen === 'overview') setCursor(c => Math.max(0, Math.min(steps.length - 1, c + d)));
        else if (stepIdx + d >= 0 && stepIdx + d < steps.length) goStep(stepIdx + d);
      }
      return;
    }

    if (screen === 'overview') {
      if (key === ',' || key === '.') {
        e.preventDefault();
        const next = Math.max(0, Math.min(SESSIONS.length - 1, sessionIdx + (key === ',' ? -1 : 1)));
        selectSession(SESSIONS[next].id);
      } else if (key === 'arrowdown' || key === 'j') {
        e.preventDefault();
        setCursor(c => Math.min(c + 1, steps.length - 1));
      } else if (key === 'arrowup' || key === 'k') {
        e.preventDefault();
        setCursor(c => Math.max(c - 1, 0));
      } else if (key === 'enter' || key === 'arrowright' || key === ' ') {
        e.preventDefault();
        start(session.id, cursor);
      } else if (key === 'v') {
        e.preventDefault();
        setHowTo(true);
      } else if (key === 'x') {
        e.preventDefault();
        if (logs[session.id]) { uncomplete(session.id); toast('Marked not done'); }
        else { complete(session.id); toast('Session logged ✓'); }
      }
      return;
    }

    if (screen === 'finish') {
      if (key === 'n') { e.preventDefault(); noteRef.current?.focus(); }
      else if (key === 'enter') { e.preventDefault(); save(); }
      else if (key === 'arrowleft') { e.preventDefault(); goStep(steps.length - 1); }
      else if (key === 'escape') { e.preventDefault(); exit(); }
      return;
    }

    // Player
    if (key === ' ') { e.preventDefault(); advance(); }
    else if (key === 'arrowright') { e.preventDefault(); goStep(stepIdx + 1); }
    else if (key === 'arrowleft') { e.preventDefault(); goStep(stepIdx - 1); }
    else if (key === 'enter' || key === 'v') { e.preventDefault(); setHowTo(true); }
    else if (key === 'escape') { e.preventDefault(); exit(); }
    else if (key === 'x') { e.preventDefault(); markDoneAndNext(); }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => handlerRef.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // Clicking into the YouTube frame steals keyboard focus from the page; take
  // it straight back so ↵ / Esc / Space keep working.
  useEffect(() => {
    if (!howTo) return;
    const reclaim = () => window.setTimeout(() => {
      if (document.activeElement instanceof HTMLIFrameElement) (document.activeElement as HTMLElement).blur();
      window.focus();
    }, 0);
    window.addEventListener('blur', reclaim);
    return () => window.removeEventListener('blur', reclaim);
  }, [howTo]);

  if (trainTab === 'plan') return <PlanView />;

  return (
    <div className="max-w-3xl mx-auto px-2 md:px-6 pb-32 pt-2">
      {screen === 'overview' && (
        <Overview
          session={session}
          sessionIdx={sessionIdx}
          steps={steps}
          cursor={cursor}
          logs={logs}
          resumeAt={active?.sessionId === session.id ? active.stepIdx : null}
          onPick={(i) => { setCursor(i); start(session.id, i); }}
          onDay={(i) => selectSession(SESSIONS[i].id)}
        />
      )}

      {screen === 'player' && step && (
        <Player
          step={step}
          stepIdx={stepIdx}
          steps={steps}
          rounds={rounds}
          done={done}
          timer={timer}
          remaining={remaining}
          onAdvance={advance}
          onPrev={() => goStep(stepIdx - 1)}
          onNext={() => goStep(stepIdx + 1)}
          onHowTo={() => setHowTo(true)}
        />
      )}

      {screen === 'finish' && (
        <div className="pt-16 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-success-500/15 text-success-500 flex items-center justify-center mb-6">
            <Check className="w-7 h-7" />
          </div>
          <h2 className="font-display text-4xl font-bold text-slate-900 dark:text-slate-100">{session.title} — done</h2>
          <p className="mt-2 text-slate-500">How did it feel? Calf, neck, energy — anything worth remembering.</p>
          <textarea
            ref={noteRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
              if (e.key === 'Escape') { e.preventDefault(); (e.target as HTMLElement).blur(); }
            }}
            rows={4}
            placeholder="e.g. calf 2/10 on the eccentrics, neck stiff on waking"
            className="mt-8 w-full max-w-xl mx-auto block rounded-xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 focus:ring-primary-500 outline-none p-4 text-base text-slate-800 dark:text-slate-200"
          />
          <button onClick={save} className="mt-6 px-6 py-3 rounded-xl bg-success-500 hover:bg-success-600 text-white font-semibold">
            Save to log
          </button>
          <Hints items={[['N', 'note'], ['↵', 'save'], ['⌘↵', 'save from note'], ['←', 'back'], ['U', 'undo'], ['Esc', 'overview']]} />
        </div>
      )}

      {howTo && howToStep && (
        <HowTo
          step={howToStep}
          iframeRef={iframeRef}
          videoPaused={videoPaused}
          onClose={() => setHowTo(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function Overview({ session, sessionIdx, steps, cursor, logs, resumeAt, onPick, onDay }: {
  session: Session;
  sessionIdx: number;
  steps: Step[];
  cursor: number;
  logs: Record<string, { completedAt: number; note?: string }>;
  resumeAt: number | null;
  onPick: (i: number) => void;
  onDay: (i: number) => void;
}) {
  const today = localDate();
  const log = logs[session.id];
  let flat = -1;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="font-display text-lg font-semibold text-orange-500/80 dark:text-orange-400/80 tracking-wide uppercase">
          Train
        </h1>
      </div>

      {/* Week strip */}
      <div className="flex gap-1.5 mb-8">
        {SESSIONS.map((s, i) => {
          const isSel = i === sessionIdx;
          const isDone = !!logs[s.id];
          return (
            <button
              key={s.id}
              onClick={() => onDay(i)}
              title={s.title}
              className={`flex-1 rounded-lg py-2 text-center transition-colors ${
                isSel ? 'bg-white dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 shadow-sm' : 'hover:bg-white/50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className={`text-xs font-medium ${s.date === today ? 'text-orange-500' : 'text-slate-400'}`}>{dayLabel(s.date)}</div>
              <div className="h-4 flex items-center justify-center">
                {isDone
                  ? <Check className="w-3.5 h-3.5 text-success-500" />
                  : <span className={`w-1.5 h-1.5 rounded-full ${isSel ? 'bg-slate-400' : 'bg-slate-300 dark:bg-slate-700'}`} />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="text-sm text-slate-400">{longDate(session.date)} · {session.minutes} min</div>
        <h2 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1 flex items-center gap-3">
          {session.title}
          {log && <Check className="w-7 h-7 text-success-500" />}
        </h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400">{session.summary}</p>
        {log?.note && <p className="mt-3 text-sm italic text-slate-500 dark:text-slate-400">“{log.note}”</p>}
      </div>

      {/* Blocks */}
      <div className="space-y-6">
        {session.blocks.map((b, bi) => (
          <div key={bi}>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{b.title}</div>
            <div>
              {b.items.map((rx, ri) => {
                flat++;
                const i = flat;
                const isCur = i === cursor;
                return (
                  <button
                    key={ri}
                    onClick={() => onPick(i)}
                    className={`w-full flex items-baseline justify-between gap-4 px-3 py-2 rounded-lg text-left transition-colors ${
                      isCur ? 'bg-white dark:bg-slate-800/80 ring-1 ring-slate-200 dark:ring-slate-700' : 'hover:bg-white/60 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <span className="text-[15px] text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      {steps[i].exercise.name}
                      {resumeAt === i && <span className="text-[10px] uppercase tracking-wider text-orange-500">resume</span>}
                    </span>
                    <span className="text-sm text-slate-500 tabular-nums shrink-0">{describeRx(rx)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Hints items={[['→ / ↵', resumeAt !== null ? 'resume' : 'start'], ['↑↓', 'pick exercise'], ['V', 'video'], [', .', 'day'], ['[ ]', 'plan'], ['X', log ? 'mark not done' : 'mark done'], ['U', 'undo']]} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

function Player({ step, stepIdx, steps, rounds, done, timer, remaining, onAdvance, onPrev, onNext, onHowTo }: {
  step: Step;
  stepIdx: number;
  steps: Step[];
  rounds: string[];
  done: number;
  timer: Timer | null;
  remaining: number;
  onAdvance: () => void;
  onPrev: () => void;
  onNext: () => void;
  onHowTo: () => void;
}) {
  const { rx, exercise } = step;
  const allDone = done >= rounds.length;
  const next = steps[stepIdx + 1];
  const isResting = timer?.kind === 'rest';
  const isHolding = timer?.kind === 'hold';
  const sideSwitch = !timer && rx.hold && rx.perSide && done % 2 === 1 && !allDone;

  const action = isResting ? 'Skip rest'
    : allDone ? 'Next exercise'
    : rx.hold ? (isHolding ? (timer!.endsAt ? 'Pause' : 'Resume') : sideSwitch ? 'Start other side' : 'Start timer')
    : `Done · ${rounds[done]}`;

  return (
    <div className="min-h-[calc(100dvh-10rem)] flex flex-col">
      {/* Progress */}
      <div className="flex items-center gap-3 text-sm text-slate-400">
        <span className="font-medium text-orange-500/90">{step.block}</span>
        <span className="tabular-nums">{stepIdx + 1} / {steps.length}</span>
        <div className="flex-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div className="h-full bg-orange-500/70 transition-all" style={{ width: `${(stepIdx / steps.length) * 100}%` }} />
        </div>
      </div>

      {/* The exercise */}
      <div className="flex-1 flex flex-col justify-center py-10">
        <h2 className="font-display text-5xl md:text-6xl font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-[1.05]">
          {exercise.name}
        </h2>
        <div className="mt-5 text-3xl md:text-4xl font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
          {describeRx(rx)}
        </div>
        {rx.rest ? <div className="mt-2 text-lg text-slate-400">Rest {rx.rest}s between sets</div> : null}
        {(rx.note || exercise.cue) && (
          <p className="mt-6 text-xl text-slate-500 dark:text-slate-400 max-w-2xl">{rx.note ?? exercise.cue}</p>
        )}

        {/* Rounds */}
        {rounds.length > 1 || rx.hold ? (
          <div className="mt-8 flex flex-wrap gap-2">
            {rounds.map((r, i) => (
              <span
                key={i}
                className={`px-3 py-1.5 rounded-full text-sm font-medium tabular-nums ${
                  i < done ? 'bg-success-500/15 text-success-600 dark:text-success-400'
                    : i === done && !allDone ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 ring-1 ring-orange-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}
              >
                {i < done && <Check className="inline w-3.5 h-3.5 -mt-0.5 mr-1" />}{r}
              </span>
            ))}
          </div>
        ) : null}

        {/* Timer */}
        {timer && (
          <div className="mt-10">
            <div className={`text-sm font-semibold uppercase tracking-wider ${isResting ? 'text-sky-500' : 'text-orange-500'}`}>
              {isResting ? 'Rest' : timer.endsAt ? 'Hold' : 'Paused'}
            </div>
            <div className={`font-display text-8xl font-bold tabular-nums ${isResting ? 'text-sky-500' : 'text-slate-900 dark:text-slate-50'} ${!timer.endsAt ? 'opacity-50' : ''}`}>
              {fmtClock(remaining)}
            </div>
            <div className="mt-3 h-1.5 max-w-md rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full ${isResting ? 'bg-sky-500' : 'bg-orange-500'}`}
                style={{ width: `${Math.max(0, Math.min(1, 1 - remaining / timer.total)) * 100}%` }}
              />
            </div>
          </div>
        )}
        {sideSwitch && <div className="mt-10 text-2xl font-semibold text-orange-500">Switch sides</div>}
        {allDone && !timer && <div className="mt-10 text-2xl font-semibold text-success-500">Done ✓</div>}
      </div>

      {/* Controls (tap) */}
      <div className="flex items-center gap-3">
        <button onClick={onPrev} className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200" aria-label="Previous">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={onAdvance}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white ${
            allDone && !timer ? 'bg-success-500 hover:bg-success-600' : 'bg-orange-500 hover:bg-orange-600'
          }`}
        >
          {rx.hold && !isResting && !allDone ? (timer?.endsAt ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />) : null}
          {action}
          <kbd className="ml-2 text-xs font-medium opacity-70">Space</kbd>
        </button>
        <button onClick={onHowTo} className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200" aria-label="How to">
          {exercise.video ? <Video className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
        </button>
        <button onClick={onNext} className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200" aria-label="Next">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
        <span className="truncate">{next ? <>Next: <span className="text-slate-600 dark:text-slate-300">{next.exercise.name}</span> · {describeRx(next.rx)}</> : 'Last one'}</span>
        <span className="hidden md:flex gap-3 shrink-0">
          <Key k="X" label="done" /><Key k="V" label="video" /><Key k="← →" label="move" /><Key k="U" label="undo" /><Key k="Esc" label="overview" />
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// How-to panel — video + cues, in-app (no tabs), fully keyboard driven.
// ---------------------------------------------------------------------------

function HowTo({ step, iframeRef, videoPaused, onClose }: {
  step: Step;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  videoPaused: boolean;
  onClose: () => void;
}) {
  const ex = step.exercise;
  const v = ex.video;
  const src = v
    ? `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&mute=1&loop=1&playlist=${v.id}&start=${v.start ?? 0}&enablejsapi=1&rel=0&modestbranding=1&playsinline=1`
    : null;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 md:p-8 bg-slate-950/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-6xl max-h-[92vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl ring-1 ring-slate-200 dark:ring-slate-800 grid md:grid-cols-[3fr_2fr]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-black md:rounded-l-2xl flex items-center">
          {src ? (
            <iframe
              key={v!.id}
              ref={iframeRef}
              src={src}
              title={ex.name}
              className="w-full aspect-video"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="w-full aspect-video flex items-center justify-center text-slate-500 text-sm">No demo video yet — follow the cues →</div>
          )}
        </div>
        <div className="p-6 md:p-8">
          <div className="text-sm font-medium text-orange-500/90">{step.block}</div>
          <h3 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mt-1">{ex.name}</h3>
          <p className="mt-3 text-lg text-slate-700 dark:text-slate-300">{ex.cue}</p>

          {ex.how.length > 0 && (
            <ol className="mt-6 space-y-2 list-decimal list-inside text-[15px] text-slate-700 dark:text-slate-300">
              {ex.how.map((h, i) => <li key={i}>{h}</li>)}
            </ol>
          )}
          {ex.avoid && ex.avoid.length > 0 && (
            <div className="mt-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Avoid</div>
              <ul className="space-y-1.5 text-[15px] text-slate-600 dark:text-slate-400">
                {ex.avoid.map((a, i) => <li key={i}>· {a}</li>)}
              </ul>
            </div>
          )}
          {ex.why && (
            <div className="mt-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Why</div>
              <p className="text-[15px] text-slate-600 dark:text-slate-400">{ex.why}</p>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-400">
            <Key k="V / Esc" label="back" />
            {src && <Key k="Space" label={videoPaused ? 'play' : 'pause'} />}
            {src && <Key k="R" label="replay" />}
            <Key k="← →" label="other exercises" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Key({ k, label }: { k: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium">{k}</kbd>
      {label}
    </span>
  );
}

function Hints({ items }: { items: [string, string][] }) {
  return (
    <div className="hidden md:flex justify-center flex-wrap gap-4 mt-10 text-sm text-slate-400">
      {items.map(([k, l]) => <Key key={k} k={k} label={l} />)}
    </div>
  );
}
