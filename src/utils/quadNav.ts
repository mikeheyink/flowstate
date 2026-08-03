/**
 * Keyboard navigation for the Today board.
 *
 * The board is a 2×2 grid, but the rows it renders come from one flat list
 * (header-q1, …q1 tasks, header-q2, …). Walking that list with ↑/↓ crosses
 * columns invisibly — from the bottom of Q1 you land at the top of Q2, which
 * sits to the *right*. So Today gets its own model: ↑/↓ move within a column
 * (Q1↔Q3, Q2↔Q4) and ←/→ move across one (Q1↔Q2, Q3↔Q4).
 *
 * Q1 Q2
 * Q3 Q4
 */

import { QUADRANTS } from './quad';

export type QuadDirection = 'up' | 'down' | 'left' | 'right';

/** Board columns — QUADRANTS is laid out in reading order, two per row. */
const COLS = 2;

interface NavRow {
    id: string;
    isHeader?: boolean;
}

/**
 * The focus stops of each quadrant, as indices into the flat list.
 *
 * Normally a quadrant's stops are its task rows. An empty quadrant's single
 * stop is its header — the board renders that as the "Nothing here" placeholder,
 * so arrowing into an empty quadrant still shows focus, and Enter there adds a
 * task with that quadrant's flags.
 */
export function quadStops(rows: NavRow[]): number[][] {
    const tasks: number[][] = QUADRANTS.map(() => []);
    const headers: number[] = QUADRANTS.map(() => -1);

    let current = -1;
    rows.forEach((row, i) => {
        if (row.isHeader) {
            current = QUADRANTS.findIndex(q => q.headerId === row.id);
            if (current >= 0) headers[current] = i;
            return;
        }
        if (current >= 0) tasks[current].push(i);
    });

    return tasks.map((stops, q) => {
        if (stops.length > 0) return stops;
        return headers[q] >= 0 ? [headers[q]] : [];
    });
}

/**
 * Index of the row to focus when `direction` is pressed, or null when the move
 * would leave the board (the edges clamp — wrapping around a grid reads as
 * random teleporting, unlike wrapping a list).
 */
export function quadNavTarget(rows: NavRow[], focusedId: string | null, direction: QuadDirection): number | null {
    const stops = quadStops(rows);

    const quad = stops.findIndex(s => s.some(i => rows[i].id === focusedId));
    if (quad === -1) {
        // Nothing focused yet — start at the top of the board.
        const first = stops.find(s => s.length > 0);
        return first ? first[0] : null;
    }
    const within = stops[quad].findIndex(i => rows[i].id === focusedId);

    if (direction === 'up' || direction === 'down') {
        const step = direction === 'down' ? 1 : -1;
        const next = within + step;
        if (next >= 0 && next < stops[quad].length) return stops[quad][next];

        // Past the quadrant's edge — continue into the one above/below it.
        const target = quad + step * COLS;
        if (target < 0 || target >= stops.length || stops[target].length === 0) return null;
        return direction === 'down' ? stops[target][0] : stops[target][stops[target].length - 1];
    }

    const column = quad % COLS;
    if (direction === 'right' && column === COLS - 1) return null;
    if (direction === 'left' && column === 0) return null;

    const target = direction === 'right' ? quad + 1 : quad - 1;
    if (stops[target].length === 0) return null;
    // Keep the vertical position where possible — a shorter column clamps.
    return stops[target][Math.min(within, stops[target].length - 1)];
}
