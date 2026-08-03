import { describe, it, expect } from 'vitest';
import { quadStops, quadNavTarget } from '../quadNav';
import { QUADRANTS } from '../quad';

/**
 * Rows shaped like useVisibleTasks' Today output:
 * header-q1, …q1 tasks, header-q2, …q2 tasks, …
 * `counts` gives how many tasks each quadrant holds.
 */
const board = (counts: [number, number, number, number]) => {
    const rows: { id: string; isHeader?: boolean }[] = [];
    QUADRANTS.forEach((q, i) => {
        rows.push({ id: q.headerId, isHeader: true });
        for (let n = 1; n <= counts[i]; n++) rows.push({ id: `${q.key}-${n}` });
    });
    return rows;
};

const at = (rows: { id: string }[], index: number | null) => (index === null ? null : rows[index].id);

describe('quadStops', () => {
    it('lists each quadrant’s task rows', () => {
        const rows = board([2, 1, 0, 0]);
        const stops = quadStops(rows);
        expect(stops[0].map(i => rows[i].id)).toEqual(['q1-1', 'q1-2']);
        expect(stops[1].map(i => rows[i].id)).toEqual(['q2-1']);
    });

    it('falls back to the header as the only stop of an empty quadrant', () => {
        const rows = board([1, 0, 0, 0]);
        const stops = quadStops(rows);
        expect(stops[1].map(i => rows[i].id)).toEqual(['header-q2']);
    });
});

describe('quadNavTarget', () => {
    it('walks down within a quadrant', () => {
        const rows = board([3, 0, 0, 0]);
        expect(at(rows, quadNavTarget(rows, 'q1-1', 'down'))).toBe('q1-2');
        expect(at(rows, quadNavTarget(rows, 'q1-2', 'up'))).toBe('q1-1');
    });

    it('steps down the column, not sideways into the next quadrant', () => {
        const rows = board([2, 2, 2, 2]);
        // The flat list would land on q2-1 here; the grid goes to the quadrant below.
        expect(at(rows, quadNavTarget(rows, 'q1-2', 'down'))).toBe('q3-1');
        expect(at(rows, quadNavTarget(rows, 'q2-2', 'down'))).toBe('q4-1');
        expect(at(rows, quadNavTarget(rows, 'q3-1', 'up'))).toBe('q1-2');
    });

    it('clamps at the top and bottom of a column', () => {
        const rows = board([1, 1, 1, 1]);
        expect(quadNavTarget(rows, 'q1-1', 'up')).toBeNull();
        expect(quadNavTarget(rows, 'q3-1', 'down')).toBeNull();
    });

    it('crosses columns with left / right', () => {
        const rows = board([2, 2, 2, 2]);
        expect(at(rows, quadNavTarget(rows, 'q1-1', 'right'))).toBe('q2-1');
        expect(at(rows, quadNavTarget(rows, 'q2-2', 'left'))).toBe('q1-2');
        expect(at(rows, quadNavTarget(rows, 'q3-1', 'right'))).toBe('q4-1');
        expect(at(rows, quadNavTarget(rows, 'q4-1', 'left'))).toBe('q3-1');
    });

    it('clamps at the outer edges of the board', () => {
        const rows = board([1, 1, 1, 1]);
        expect(quadNavTarget(rows, 'q1-1', 'left')).toBeNull();
        expect(quadNavTarget(rows, 'q2-1', 'right')).toBeNull();
    });

    it('keeps the vertical position when crossing, clamped to a shorter column', () => {
        const rows = board([4, 2, 0, 0]);
        expect(at(rows, quadNavTarget(rows, 'q1-2', 'right'))).toBe('q2-2');
        expect(at(rows, quadNavTarget(rows, 'q1-4', 'right'))).toBe('q2-2');
    });

    it('lands on an empty quadrant’s header so focus stays visible', () => {
        const rows = board([1, 0, 0, 1]);
        expect(at(rows, quadNavTarget(rows, 'q1-1', 'right'))).toBe('header-q2');
        expect(at(rows, quadNavTarget(rows, 'q1-1', 'down'))).toBe('header-q3');
        // …and moves back out of it.
        expect(at(rows, quadNavTarget(rows, 'header-q2', 'down'))).toBe('q4-1');
        expect(at(rows, quadNavTarget(rows, 'header-q2', 'left'))).toBe('q1-1');
    });

    it('starts at the top of the board when nothing is focused', () => {
        const rows = board([2, 1, 0, 0]);
        expect(at(rows, quadNavTarget(rows, null, 'down'))).toBe('q1-1');
    });

    it('handles an entirely empty board', () => {
        const rows = board([0, 0, 0, 0]);
        expect(at(rows, quadNavTarget(rows, 'header-q1', 'right'))).toBe('header-q2');
        expect(at(rows, quadNavTarget(rows, 'header-q1', 'down'))).toBe('header-q3');
        expect(quadNavTarget(rows, 'header-q3', 'down')).toBeNull();
    });
});
