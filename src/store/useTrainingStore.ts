import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SessionLog {
  completedAt: number;
  note?: string;
}

/**
 * Where you are in a workout. Kept in the store (not the component) so
 * switching sections mid-session and coming back lands on the same exercise.
 */
export interface ActiveWorkout {
  sessionId: string;
  stepIdx: number;
  roundsDone: Record<number, number>; // stepIdx → rounds ticked
}

type Snapshot = Pick<TrainingState, 'logs' | 'active' | 'milestonesDone'>;

interface TrainingState {
  logs: Record<string, SessionLog>;
  active: ActiveWorkout | null;
  selectedSessionId: string | null;
  milestonesDone: Record<string, number>; // milestone id → when it was ticked
  // Undo stack for the things worth undoing — ticked sets, mark done, save.
  // Navigation isn't recorded: ← / → already moves you back.
  history: Snapshot[];

  selectSession: (id: string) => void;
  start: (sessionId: string, stepIdx?: number) => void;
  goToStep: (stepIdx: number) => void;
  setRoundsDone: (stepIdx: number, n: number) => void;
  exit: () => void;
  complete: (sessionId: string, note?: string) => void;
  uncomplete: (sessionId: string) => void;
  toggleMilestone: (id: string) => void;
  /** Returns false when there's nothing to undo. */
  undo: () => boolean;
}

const HISTORY_LIMIT = 50;

// Local-only for now (persisted to localStorage). The workout is done on the
// laptop it's logged on; moving logs to Supabase comes with progress tracking.
export const useTrainingStore = create<TrainingState>()(
  persist(
    (set, get) => {
      const record = () => set((s) => ({
        history: [...s.history, { logs: s.logs, active: s.active, milestonesDone: s.milestonesDone }].slice(-HISTORY_LIMIT),
      }));
      return {
      logs: {},
      active: null,
      selectedSessionId: null,
      milestonesDone: {},
      history: [],

      selectSession: (id) => set({ selectedSessionId: id }),
      start: (sessionId, stepIdx = 0) => set((s) => ({
        selectedSessionId: sessionId,
        active: s.active?.sessionId === sessionId
          ? { ...s.active, stepIdx }
          : { sessionId, stepIdx, roundsDone: {} },
      })),
      goToStep: (stepIdx) => set((s) => (s.active ? { active: { ...s.active, stepIdx } } : {})),
      setRoundsDone: (stepIdx, n) => { record(); set((s) => (s.active
        ? { active: { ...s.active, roundsDone: { ...s.active.roundsDone, [stepIdx]: n } } }
        : {})); },
      exit: () => set({ active: null }),
      complete: (sessionId, note) => { record(); set((s) => ({
        logs: { ...s.logs, [sessionId]: { completedAt: Date.now(), ...(note?.trim() ? { note: note.trim() } : {}) } },
        active: null,
      })); },
      uncomplete: (sessionId) => { record(); set((s) => {
        const logs = { ...s.logs };
        delete logs[sessionId];
        return { logs };
      }); },
      toggleMilestone: (id) => { record(); set((s) => {
        const milestonesDone = { ...s.milestonesDone };
        if (milestonesDone[id]) delete milestonesDone[id];
        else milestonesDone[id] = Date.now();
        return { milestonesDone };
      }); },
      undo: () => {
        const { history } = get();
        const prev = history[history.length - 1];
        if (!prev) return false;
        set({
          logs: prev.logs,
          active: prev.active,
          milestonesDone: prev.milestonesDone,
          history: history.slice(0, -1),
          // Land back on the session being undone, even from another day.
          ...(prev.active ? { selectedSessionId: prev.active.sessionId } : {}),
        });
        return true;
      },
      };
    },
    {
      name: 'flowstate-training',
      partialize: (s) => ({ logs: s.logs, active: s.active, selectedSessionId: s.selectedSessionId, milestonesDone: s.milestonesDone }),
    }
  )
);
