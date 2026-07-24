/**
 * Eisenhower quadrant utilities
 *
 * A task's quadrant is *derived* from its two manual flags (urgent, important) —
 * `quadOrder` only decides position within whichever quadrant the task is in.
 * That single decision keeps every move/toggle case simple: flags are the only
 * way to cross quadrants, and ordering never leaks between them.
 */

import { Task } from '../types';

export type QuadrantKey = 'q1' | 'q2' | 'q3' | 'q4';

export interface QuadrantDef {
    key: QuadrantKey;
    title: string;
    subtitle: string;
    headerId: string;
    hotkey: string; // '1'..'4' — jump focus to this quadrant in the Today view
}

// Reading order (and the 2×2 layout order): Q1 top-left … Q4 bottom-right.
// Q2 is the "hero" quadrant — the objectives live there — which the board
// expresses through color emphasis, not size.
export const QUADRANTS: QuadrantDef[] = [
    { key: 'q1', title: 'Do now', subtitle: 'Urgent & important', headerId: 'header-q1', hotkey: '1' },
    { key: 'q2', title: 'Schedule', subtitle: 'Important, not urgent', headerId: 'header-q2', hotkey: '2' },
    { key: 'q3', title: 'Contain', subtitle: 'Urgent, not important', headerId: 'header-q3', hotkey: '3' },
    { key: 'q4', title: 'Everything else', subtitle: 'Neither — do quickly, delegate or drop', headerId: 'header-q4', hotkey: '4' },
];

export const quadrantOf = (t: Pick<Task, 'urgent' | 'important'>): QuadrantKey =>
    t.important ? (t.urgent ? 'q1' : 'q2') : (t.urgent ? 'q3' : 'q4');

/** Inverse of quadrantOf — the flags a task needs to live in a quadrant. */
export const quadrantFlags = (key: QuadrantKey): { urgent: boolean; important: boolean } => ({
    urgent: key === 'q1' || key === 'q3',
    important: key === 'q1' || key === 'q2',
});

/**
 * Effective sort key within a quadrant. Tasks never manually placed fall back
 * to createdAt (a large ms timestamp), which lands them *below* anything that
 * has been deliberately positioned (small i*1000 values) — new arrivals queue
 * at the bottom until you place them.
 */
export const quadKey = (t: Pick<Task, 'quadOrder' | 'createdAt'>): number =>
    t.quadOrder ?? t.createdAt;

export const sortQuadrant = <T extends Task>(tasks: T[]): T[] =>
    [...tasks].sort((a, b) => quadKey(a) - quadKey(b) || a.createdAt - b.createdAt);

/**
 * quadOrder value that places a task at the top of a quadrant.
 * Toggling u/i inserts at the top: you just decided it matters differently,
 * so it's top-of-mind — and focus follows it, so ⌘↓ places it from there.
 */
export const topOfQuadrant = (members: Task[]): number =>
    members.length > 0 ? Math.min(...members.map(quadKey)) - 1000 : 0;
