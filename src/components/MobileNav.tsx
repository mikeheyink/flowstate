import React from 'react';
import { Inbox, Calendar as CalendarIcon, CalendarClock, ClipboardList, Flame, Compass, Mountain } from 'lucide-react';
import { useUIStore } from '../store/useUIStore';
import { useTaskStore } from '../store/useTaskStore';

// Bottom tab bar — the mobile navigation anchor. The desktop app drives every
// section/filter from the keyboard and the TopNav; on touch there's no keyboard,
// so these destinations need to be one thumb-tap away. Hidden on md+ (`md:hidden`)
// so desktop is completely untouched.
type Dest =
    | { kind: 'task'; filter: 'active' | 'today' | 'upcoming' | 'review'; label: string; Icon: React.ComponentType<any> }
    | { kind: 'habits'; label: string; Icon: React.ComponentType<any> }
    | { kind: 'objectives'; label: string; Icon: React.ComponentType<any> }
    | { kind: 'adventure'; label: string; Icon: React.ComponentType<any> };

const DESTS: Dest[] = [
    { kind: 'task', filter: 'today', label: 'Today', Icon: CalendarIcon },
    { kind: 'task', filter: 'active', label: 'Plan', Icon: Inbox },
    { kind: 'task', filter: 'upcoming', label: 'Upcoming', Icon: CalendarClock },
    { kind: 'task', filter: 'review', label: 'Review', Icon: ClipboardList },
    { kind: 'habits', label: 'Habits', Icon: Flame },
    { kind: 'objectives', label: 'Values', Icon: Compass },
    { kind: 'adventure', label: 'Adventure', Icon: Mountain },
];

export function MobileNav() {
    const { currentView, filter, setFilter, setCurrentView, setFocusMode } = useUIStore();

    const go = (dest: Dest) => {
        if (dest.kind === 'habits') {
            setCurrentView('habits');
        } else if (dest.kind === 'objectives') {
            setCurrentView('objectives');
        } else if (dest.kind === 'adventure') {
            setCurrentView('adventure');
        } else {
            setCurrentView('tasks');
            setFilter(dest.filter);
        }
        setFocusMode('main');
        // Deselect when switching destinations so the FAB / keyboard context resets.
        useTaskStore.getState().setFocusedId(null);
    };

    const isActive = (dest: Dest) =>
        dest.kind === 'habits'
            ? currentView === 'habits'
            : dest.kind === 'objectives'
                ? currentView === 'objectives'
                : dest.kind === 'adventure'
                    ? currentView === 'adventure'
                    : currentView === 'tasks' && filter === dest.filter;

    return (
        <nav
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch
                       bg-white/90 dark:bg-slate-900/90 backdrop-blur-md
                       border-t border-slate-200 dark:border-slate-800
                       pb-[env(safe-area-inset-bottom)]"
            aria-label="Primary"
        >
            {DESTS.map((dest) => {
                const active = isActive(dest);
                return (
                    <button
                        key={dest.label}
                        onClick={() => go(dest)}
                        aria-current={active ? 'page' : undefined}
                        className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors ${
                            active
                                ? 'text-primary-600 dark:text-primary-400'
                                : 'text-slate-400 dark:text-slate-500 active:text-slate-600 dark:active:text-slate-300'
                        }`}
                    >
                        <dest.Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
                        <span className="text-[10px] font-medium leading-none">{dest.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
