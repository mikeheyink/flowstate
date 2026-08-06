import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseAdventureInput, parseDateEntry } from '../adventureInput';

// chrono resolves relative dates against "now", so pin it.
const NOW = new Date(2026, 7, 6, 9, 0, 0); // Thu 6 Aug 2026

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

const ymd = (ts: number) => { const d = new Date(ts); return [d.getFullYear(), d.getMonth(), d.getDate()]; };

describe('parseAdventureInput', () => {
  it('splits a trailing date off the title', () => {
    const r = parseAdventureInput('Erinvale Golf 15 Aug');
    expect(r.title).toBe('Erinvale Golf');
    expect(ymd(r.date!)).toEqual([2026, 7, 15]);
  });

  it('handles a date in the middle of the text', () => {
    const r = parseAdventureInput('Zimbali 23 Dec with the family');
    expect(r.title).toBe('Zimbali with the family');
    expect(ymd(r.date!)).toEqual([2026, 11, 23]);
  });

  it('leaves a title with no date completely alone', () => {
    const r = parseAdventureInput('Golf Tour');
    expect(r.title).toBe('Golf Tour');
    expect(r.date).toBeNull();
    expect(r.dateText).toBeNull();
  });

  it('resolves relative dates forward, never into the past', () => {
    expect(ymd(parseAdventureInput('Trail run tomorrow').date!)).toEqual([2026, 7, 7]);
    // Thursday "tue" must mean next week's, not two days ago.
    const tue = parseAdventureInput('Braai tue').date!;
    expect(new Date(tue).getTime()).toBeGreaterThan(NOW.getTime());
    expect(new Date(tue).getDay()).toBe(2);
  });

  it('normalises to local noon so the day cannot drift', () => {
    const d = new Date(parseAdventureInput('Drakensberg 20 Dec').date!);
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([12, 0, 0]);
  });

  it('reports what it matched so the UI can show it', () => {
    expect(parseAdventureInput('Japan Trip next friday').dateText).toContain('friday');
  });

  it('does not eat # or ! the way the task parser does', () => {
    const r = parseAdventureInput('Golf with #dad !important');
    expect(r.title).toBe('Golf with #dad !important');
  });

  it('collapses the whitespace left behind by the removed date', () => {
    expect(parseAdventureInput('Onrus   Trip    tomorrow').title).toBe('Onrus Trip');
  });

  it('returns an empty title for a date-only entry', () => {
    const r = parseAdventureInput('15 Aug');
    expect(r.title).toBe('');
    expect(r.date).not.toBeNull();
  });
});

describe('parseDateEntry', () => {
  it('parses a bare date', () => {
    expect(ymd(parseDateEntry('23 Dec')!)).toEqual([2026, 11, 23]);
  });

  it('treats empty or whitespace input as "no date"', () => {
    expect(parseDateEntry('')).toBeNull();
    expect(parseDateEntry('   ')).toBeNull();
  });

  it('returns null for text it cannot understand', () => {
    expect(parseDateEntry('somewhere nice')).toBeNull();
  });

  it('normalises to local noon', () => {
    const d = new Date(parseDateEntry('tomorrow')!);
    expect(d.getHours()).toBe(12);
  });
});
