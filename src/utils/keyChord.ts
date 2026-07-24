/**
 * Coordination between the two window-level keydown handlers:
 * useHotkeys owns the g-chord ("g then i" → go to Inbox, …) while
 * useTaskListKeyboard owns single-letter task actions ("u", "i", "e", …).
 *
 * Without this, pressing "g then i" would ALSO toggle Important on the focused
 * task. Listener registration order between the two hooks is not stable (the
 * task-list handler re-registers whenever its deps change), so we guard both
 * directions: a pending flag covers "task handler ran first", and marking the
 * event covers "chord handler ran first".
 */

let gChordPending = false;

export const setGChordPending = (pending: boolean) => {
    gChordPending = pending;
};

export const isGChordPending = () => gChordPending;

export const markKeyConsumed = (e: KeyboardEvent) => {
    (e as any).__flowConsumed = true;
};

export const isKeyConsumed = (e: KeyboardEvent) =>
    (e as any).__flowConsumed === true;
