import { describe, it, expect, beforeEach } from 'vitest';
import { useTrainingStore } from '../useTrainingStore';

const s = () => useTrainingStore.getState();

describe('useTrainingStore undo', () => {
  beforeEach(() => {
    useTrainingStore.setState({ logs: {}, active: null, selectedSessionId: null, history: [] });
  });

  it('undoes a ticked set and returns to the exercise it was ticked on', () => {
    s().start('a', 2);
    s().setRoundsDone(2, 1);
    s().goToStep(3);
    expect(s().undo()).toBe(true);
    expect(s().active).toEqual({ sessionId: 'a', stepIdx: 2, roundsDone: {} });
  });

  it('undoes saving a session — back on the finish screen, log removed', () => {
    s().start('a', 5);
    s().complete('a', 'felt good');
    expect(s().logs.a?.note).toBe('felt good');
    s().undo();
    expect(s().logs.a).toBeUndefined();
    expect(s().active?.stepIdx).toBe(5);
  });

  it('undoes mark done / not done, and reports when there is nothing left', () => {
    s().complete('b');
    s().uncomplete('b');
    s().undo();
    expect(s().logs.b).toBeDefined();
    s().undo();
    expect(s().logs.b).toBeUndefined();
    expect(s().undo()).toBe(false);
  });
});
