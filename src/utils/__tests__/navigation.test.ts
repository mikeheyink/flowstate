import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../../store/useUIStore';
import { SECTIONS, cycleSection, cycleTab, goTo, resolveChord, tabsFor } from '../navigation';

const ui = () => useUIStore.getState();

describe('navigation registry', () => {
  beforeEach(() => {
    useUIStore.setState({ currentView: 'tasks', filter: 'today', habitView: 'grid', trainTab: 'session' });
  });

  it('⌘[ / ⌘] walk every section and wrap', () => {
    useUIStore.setState({ currentView: SECTIONS[SECTIONS.length - 1].id });
    cycleSection(1);
    expect(ui().currentView).toBe(SECTIONS[0].id);
    cycleSection(-1);
    expect(ui().currentView).toBe(SECTIONS[SECTIONS.length - 1].id);
  });

  it('[ / ] flips Train between Session and Plan', () => {
    goTo('train');
    expect(cycleTab(1)).toBe('Train · Plan');
    expect(ui().trainTab).toBe('plan');
    cycleTab(1);
    expect(ui().trainTab).toBe('session');
    cycleTab(-1);
    expect(ui().trainTab).toBe('plan');
  });

  it('[ / ] cycles Tasks and Habits tabs the same way', () => {
    cycleTab(1);
    expect(ui().filter).toBe('upcoming');
    goTo('habits');
    cycleTab(-1);
    expect(ui().habitView).toBe('analytics');
  });

  it('mobile Habits skips the grid, and treats a stored grid as checklist', () => {
    goTo('habits');
    expect(tabsFor('habits', true).map(t => t.id)).toEqual(['checklist', 'analytics']);
    cycleTab(1, true);
    expect(ui().habitView).toBe('analytics');
  });

  it('sections without tabs ignore [ / ]', () => {
    goTo('objectives');
    expect(cycleTab(1)).toBeNull();
    expect(ui().currentView).toBe('objectives');
  });

  it('g-chords resolve to sections and task tabs', () => {
    expect(resolveChord('w')).toEqual({ view: 'train' });
    expect(resolveChord('a')).toEqual({ view: 'adventure' });
    expect(resolveChord('t')).toEqual({ view: 'tasks', tab: 'today' });
    expect(resolveChord('i')).toEqual({ view: 'tasks', tab: 'active' });
    expect(resolveChord('z')).toBeNull();
  });
});
