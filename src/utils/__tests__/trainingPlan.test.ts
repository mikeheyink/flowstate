import { describe, it, expect } from 'vitest';
import { roundsFor, describeRx, defaultSessionIndex, flattenSession, getExercise, SESSIONS, Session } from '../trainingPlan';

describe('roundsFor', () => {
  it('counts sets for rep work', () => {
    expect(roundsFor({ ex: 'goblet-squat', sets: 2, reps: '10' })).toEqual(['Set 1', 'Set 2']);
    expect(roundsFor({ ex: 'cat-cow', reps: '8' })).toEqual(['Go']);
  });
  it('splits per-side holds into left / right rounds', () => {
    expect(roundsFor({ ex: 'side-plank', sets: 2, hold: 30, perSide: true }))
      .toEqual(['Set 1 · Left', 'Set 1 · Right', 'Set 2 · Left', 'Set 2 · Right']);
    expect(roundsFor({ ex: 'upper-trap-stretch', hold: 30, perSide: true })).toEqual(['Left', 'Right']);
  });
});

describe('describeRx', () => {
  it('formats reps, holds and load', () => {
    expect(describeRx({ ex: 'x', sets: 2, reps: '10', load: '16 kg' })).toBe('2 × 10 · 16 kg');
    expect(describeRx({ ex: 'x', sets: 4, hold: 40 })).toBe('4 × 40s');
    expect(describeRx({ ex: 'x', sets: 2, hold: 20, perSide: true })).toBe('2 × 20s / side');
    expect(describeRx({ ex: 'x', hold: 35 * 60 })).toBe('35 min');
  });
});

describe('defaultSessionIndex', () => {
  const s = (date: string) => ({ id: date, date } as Session);
  const list = [s('2026-10-05'), s('2026-10-07')];
  it('prefers today, then the next session, then the last', () => {
    expect(defaultSessionIndex(list, '2026-10-05')).toBe(0);
    expect(defaultSessionIndex(list, '2026-10-06')).toBe(1);
    expect(defaultSessionIndex(list, '2026-10-20')).toBe(1);
  });
});

describe('plan integrity', () => {
  it('every prescribed exercise exists in the library', () => {
    for (const session of SESSIONS) {
      for (const step of flattenSession(session)) {
        expect(getExercise(step.rx.ex).how.length, `${session.id}: ${step.rx.ex}`).toBeGreaterThan(0);
      }
    }
  });
  it('session ids are unique', () => {
    expect(new Set(SESSIONS.map(s => s.id)).size).toBe(SESSIONS.length);
  });
});

describe('weeks', () => {
  it('every week that has started has sessions written up to the latest one', async () => {
    const { weekOf } = await import('../trainingPlan');
    const weeks = new Set(SESSIONS.map(s => weekOf(s.date)));
    const last = Math.max(...weeks);
    for (let w = 1; w <= last; w++) expect(weeks.has(w), `week ${w}`).toBe(true);
  });
});

describe('supersets and time estimates', () => {
  it('pairs superset partners within a block', async () => {
    const { supersetPartner } = await import('../trainingPlan');
    const session = SESSIONS.find(s => s.id === '2026-10-12-strength-a')!;
    const steps = flattenSession(session);
    const squat = steps.findIndex(s => s.rx.ex === 'goblet-squat');
    const row = steps.findIndex(s => s.rx.ex === 'kb-row');
    expect(supersetPartner(steps, squat)).toBe(row);
    expect(supersetPartner(steps, row)).toBe(squat);
    expect(supersetPartner(steps, 0)).toBeNull();
  });

  it('rests once per superset round, not after each exercise', async () => {
    const { blockSeconds } = await import('../trainingPlan');
    const paired = blockSeconds({ title: 'x', items: [
      { ex: 'a', sets: 3, reps: '10', superset: 'a' },
      { ex: 'b', sets: 3, reps: '10', rest: 60, superset: 'a' },
    ] });
    // 3 rounds × (40 + 40) + 2 rests × 60 + 2 × 15 setup
    expect(paired).toBe(240 + 120 + 30);
  });

  it('estimates a believable length for the week 2 strength day', async () => {
    const { sessionMinutes } = await import('../trainingPlan');
    const m = sessionMinutes(SESSIONS.find(s => s.id === '2026-10-12-strength-a')!);
    // Core (warm-up + supersets) fits a ~30 min morning; calf + neck are "anytime".
    expect(m).toBeGreaterThanOrEqual(25);
    expect(m).toBeLessThanOrEqual(35);
  });
});
