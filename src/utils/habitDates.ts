/**
 * Habit date helpers — single source of truth for week math.
 *
 * Everything is done in LOCAL time and habit days are stored as 'YYYY-MM-DD'
 * local-date strings. We deliberately avoid Date.toISOString() for day keys:
 * that converts to UTC and, on machines offset from UTC, shifts the boundary
 * days (Mon/Sun) into the wrong week — which silently dropped Monday toggles.
 *
 * Day indices are 0 = Monday … 6 = Sunday throughout the habit feature.
 */

/** Format a Date as a local 'YYYY-MM-DD' string (no UTC conversion). */
export function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** ISO week label, e.g. "2026-W24", for a given date. */
export function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/** The Monday (local) that starts the given ISO week. */
export function getWeekStart(weekStr: string): Date {
  const year = parseInt(weekStr.substring(0, 4));
  const week = parseInt(weekStr.substring(6, 8));

  // Monday of ISO week 1 (the week containing Jan 4th).
  const jan4 = new Date(year, 0, 4);
  const weekStart = new Date(jan4);
  weekStart.setDate(weekStart.getDate() - ((jan4.getDay() + 6) % 7));
  weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

/** The seven local dates (Mon→Sun) of the given ISO week. */
export function getWeekDates(weekStr: string): Date[] {
  const start = getWeekStart(weekStr);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** Local 'YYYY-MM-DD' bounds [start, end] (Mon..Sun) for string comparison. */
export function getWeekRange(weekStr: string): { startStr: string; endStr: string } {
  const dates = getWeekDates(weekStr);
  return { startStr: toLocalISO(dates[0]), endStr: toLocalISO(dates[6]) };
}

/** Step an ISO week label forward/back by whole weeks. */
export function shiftWeek(weekStr: string, deltaWeeks: number): string {
  const start = getWeekStart(weekStr);
  start.setDate(start.getDate() + deltaWeeks * 7);
  return getISOWeek(start);
}
