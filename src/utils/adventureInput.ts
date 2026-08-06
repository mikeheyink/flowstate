import * as chrono from 'chrono-node';

/**
 * Parse "Erinvale Golf 15 Aug" into a title and a date.
 *
 * Same chrono-node engine the task input uses (utils/nlp.ts) with `forwardDate`
 * so a bare "fri" or "15 Aug" means the next one, not the last. Deliberately
 * does NOT strip `#tags` or `!priority` the way parseTaskInput does — an
 * adventure title is prose, and categories are set with `c`, not typed.
 *
 * Dates land at local noon so a row can't drift across a day boundary through a
 * timezone or DST shift — matching how the seeds are built.
 */
export interface ParsedAdventure {
  title: string;
  date: number | null;
  /** The exact substring chrono claimed, so the UI can show what it understood. */
  dateText: string | null;
}

export function parseAdventureInput(input: string): ParsedAdventure {
  let text = input;
  let date: number | null = null;
  let dateText: string | null = null;

  const results = chrono.parse(text, new Date(), { forwardDate: true });
  if (results.length > 0) {
    const r = results[0];
    const d = r.start.date();
    date = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0).getTime();
    dateText = r.text;
    text = text.replace(r.text, '');
  }

  return { title: text.replace(/\s+/g, ' ').trim(), date, dateText };
}

/** Parse a bare date entry (the `d` key). Empty input means "clear the date". */
export function parseDateEntry(input: string): number | null {
  if (!input.trim()) return null;
  const results = chrono.parse(input, new Date(), { forwardDate: true });
  if (results.length === 0) return null;
  const d = results[0].start.date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0).getTime();
}
