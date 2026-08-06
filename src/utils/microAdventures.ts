/**
 * Micro-adventures — the "see each day as a source of adventure" half of the
 * Adventure page. One prompt surfaces on the daily soft-start, beneath the
 * objectives: a nudge that today is available, not just the big trips on the
 * Horizon.
 *
 * Deliberately a static list, not a generator: it's a nudge, not a task, and it
 * must be identical every time the day is re-rendered. The pick is derived from
 * the date, so it's stable all day and cycles predictably.
 */

export const MICRO_ADVENTURES: string[] = [
  'Take a different route — walk, drive or run somewhere you’ve never been.',
  'Say yes to the first small invitation that comes your way.',
  'Cook something you’ve never cooked before.',
  'Have a real conversation with someone you barely know.',
  'Be outside for sunrise or sunset — no phone.',
  'Swim in water you didn’t plan to swim in.',
  'Ask someone about the best thing that happened to them this week.',
  'Go somewhere without deciding first where you’ll end up.',
  'Learn one small thing well enough to explain it tonight.',
  'Take the harder, more interesting option in something ordinary.',
  'Call the friend you keep meaning to call.',
  'Find a view you haven’t seen before and sit with it.',
  'Do the thing you’ve been putting off — make it the adventure.',
  'Bring someone along to something you’d normally do alone.',
  'Explore a part of town you have no reason to visit.',
  'Move your body somewhere new — a different trail, court or road.',
  'Eat somewhere chosen at random.',
  'Write down what today’s adventure was, before you sleep.',
  'Wake up an hour earlier and use it on something you love.',
  'Make a plan for a future adventure — plant a seed today.',
  'Do something slightly outside your comfort zone before noon.',
  'Notice five things on your commute you’ve never noticed.',
];

/**
 * Pick today's prompt. Derived from the local date so it's stable for the whole
 * day and independent of render count or timezone-shifted UTC boundaries.
 */
export function microAdventureForDate(d: Date = new Date()): string {
  const dayNumber = Math.floor(
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000
  );
  const idx = ((dayNumber % MICRO_ADVENTURES.length) + MICRO_ADVENTURES.length) % MICRO_ADVENTURES.length;
  return MICRO_ADVENTURES[idx];
}
