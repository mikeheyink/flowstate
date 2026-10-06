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
