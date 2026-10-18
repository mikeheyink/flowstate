/**
 * Navigation registry — the one place that knows the app's sections and the
 * tabs inside each. The desktop TopNav, the mobile bottom bar + header tabs,
 * the keyboard (⌘[ / ⌘] sections, [ / ] tabs, g-chords) and the command
 * palette all read from here, so adding a section or tab can't leave one of
 * them behind.
 */
import React from 'react';
import {
    Compass, ClipboardList, Flame, Mountain, Dumbbell,
    Inbox, Calendar as CalendarIcon, CalendarClock, LayoutGrid, ListChecks, BarChart3,
    PlayCircle, Map as MapIcon,
} from 'lucide-react';
import { useUIStore, CurrentView } from '../store/useUIStore';

type Icon = React.ComponentType<any>;

export type SectionId = Extract<CurrentView, 'objectives' | 'tasks' | 'habits' | 'adventure' | 'train'>;

export interface Section {
    id: SectionId;
    label: string;
    Icon: Icon;
    /** Second key of the g-chord that jumps here ("g then o"). */
    chord: string;
}

export interface Tab {
    id: string;
    label: string;
    Icon: Icon;
    /** g-chord that lands on this exact tab, when there is one. */
    chord?: string;
}

// Order = ⌘[ / ⌘] order = left-to-right in both navs.
// (Mail exists in the codebase but isn't shipped yet, so it's not listed.)
export const SECTIONS: Section[] = [
    { id: 'objectives', label: 'Objectives', Icon: Compass, chord: 'o' },
    { id: 'tasks', label: 'Tasks', Icon: ClipboardList, chord: 't' },
    { id: 'habits', label: 'Habits', Icon: Flame, chord: 'h' },
    { id: 'adventure', label: 'Adventure', Icon: Mountain, chord: 'a' },
    { id: 'train', label: 'Train', Icon: Dumbbell, chord: 'w' },
];

const TASK_TABS: Tab[] = [
    { id: 'active', label: 'Plan', Icon: Inbox, chord: 'i' },
    { id: 'today', label: 'Today', Icon: CalendarIcon, chord: 't' },
    { id: 'upcoming', label: 'Upcoming', Icon: CalendarClock, chord: 'u' },
    { id: 'review', label: 'Review', Icon: ClipboardList, chord: 'r' },
];

const HABIT_TABS: Tab[] = [
    { id: 'grid', label: 'Grid', Icon: LayoutGrid },
    { id: 'checklist', label: 'Checklist', Icon: ListChecks },
    { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
];

// The 7-day grid doesn't fit a phone, so mobile Habits offers Checklist +
// Analytics only (a persisted 'grid' shows as Checklist there).
const HABIT_TABS_MOBILE = HABIT_TABS.filter(t => t.id !== 'grid');

const TRAIN_TABS: Tab[] = [
    { id: 'session', label: 'Session', Icon: PlayCircle },
    { id: 'plan', label: 'Plan', Icon: MapIcon },
];

export function tabsFor(view: CurrentView, mobile = false): Tab[] {
    if (view === 'tasks') return TASK_TABS;
    if (view === 'habits') return mobile ? HABIT_TABS_MOBILE : HABIT_TABS;
    if (view === 'train') return TRAIN_TABS;
    return [];
}

export function sectionLabel(view: CurrentView): string {
    return SECTIONS.find(s => s.id === view)?.label ?? 'Mail';
}

/** The active tab id for a section, read from the UI store. */
export function activeTabId(view: CurrentView, mobile = false): string | null {
    const ui = useUIStore.getState();
    if (view === 'tasks') return ui.filter;
    if (view === 'habits') return mobile && ui.habitView === 'grid' ? 'checklist' : ui.habitView;
    if (view === 'train') return ui.trainTab;
    return null;
}

function applyTab(view: CurrentView, id: string) {
    const ui = useUIStore.getState();
    if (view === 'tasks') ui.setFilter(id as any);
    else if (view === 'habits') ui.setHabitView(id as any);
    else if (view === 'train') ui.setTrainTab(id as any);
}

/** "Train · Plan" — what a toast says after moving. */
function where(view: CurrentView, tabId?: string | null): string {
    const tab = tabId ? tabsFor(view).find(t => t.id === tabId) : null;
    return tab ? `${sectionLabel(view)} · ${tab.label}` : sectionLabel(view);
}

/** Go to a section (and optionally one of its tabs). Returns a label for a toast. */
export function goTo(view: SectionId, tabId?: string): string {
    const ui = useUIStore.getState();
    ui.setCurrentView(view);
    ui.setFocusMode('main');
    if (tabId) applyTab(view, tabId);
    return where(view, tabId ?? (tabsFor(view).length ? activeTabId(view) : null));
}

/** ⌘[ / ⌘] — previous / next section, wrapping. */
export function cycleSection(dir: 1 | -1): string {
    const cur = Math.max(0, SECTIONS.findIndex(s => s.id === useUIStore.getState().currentView));
    const next = SECTIONS[(cur + dir + SECTIONS.length) % SECTIONS.length];
    return goTo(next.id);
}

/** [ / ] — previous / next tab inside the current section. Null when it has none. */
export function cycleTab(dir: 1 | -1, mobile = false): string | null {
    const view = useUIStore.getState().currentView;
    const tabs = tabsFor(view, mobile);
    if (tabs.length < 2) return null;
    const cur = Math.max(0, tabs.findIndex(t => t.id === activeTabId(view, mobile)));
    const next = tabs[(cur + dir + tabs.length) % tabs.length];
    applyTab(view, next.id);
    return where(view, next.id);
}

/** Pick a tab in the current section (a click/tap on a tab pill). */
export function selectTab(id: string) {
    const view = useUIStore.getState().currentView;
    applyTab(view, id);
    useUIStore.getState().setFocusMode('main');
}

/**
 * g-chords: "g then <key>". Task tabs get their own letters (i/t/u/r), every
 * other section one letter each. Returns null when the key isn't a chord.
 */
export function resolveChord(key: string): { view: SectionId; tab?: string } | null {
    const taskTab = TASK_TABS.find(t => t.chord === key);
    if (taskTab) return { view: 'tasks', tab: taskTab.id };
    const section = SECTIONS.find(s => s.chord === key && s.id !== 'tasks');
    return section ? { view: section.id } : null;
}
