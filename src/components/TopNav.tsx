import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Layers, Inbox, Calendar as CalendarIcon, CalendarClock, ClipboardList, RefreshCw, WifiOff, UserX, Keyboard, Command, BookOpen, Reply, Mail, LayoutGrid, ListChecks, BarChart3, Flame, Compass } from 'lucide-react';
import { useUIStore, CurrentView } from '../store/useUIStore';
import { useOnlineStatus } from '../store/useOnlineStatus';
import { useMailStore } from '../store/useMailStore';
import { useTaskStore } from '../store/useTaskStore';
import { useIsMobile } from '../hooks/useIsMobile';
import { supabase } from '../utils/supabase';

interface TopNavProps {
    session: any;
    isGuest: boolean;
    setGuestMode: (mode: boolean) => void;
}

// Top-level sections — the persistent anchor. Switch with ⌘[ / ⌘].
// (Mail exists in the codebase but isn't shipped yet, so it's not offered here.)
const SECTIONS: { id: CurrentView; label: string; Icon: React.ComponentType<any>; chord: string }[] = [
    { id: 'objectives', label: 'Objectives', Icon: Compass, chord: '⌘[ / ⌘]' },
    { id: 'tasks', label: 'Tasks', Icon: ClipboardList, chord: '⌘[ / ⌘]' },
    { id: 'habits', label: 'Habits', Icon: Flame, chord: '⌘[ / ⌘]' },
];

export function TopNav({ session, isGuest, setGuestMode }: TopNavProps) {
    const {
        filter,
        currentView,
        habitView,
        setFilter,
        setFocusMode,
        setShortcutsOpen,
        setCmdOpen,
        setCurrentView,
        setHabitView,
    } = useUIStore();

    const pendingCount = useTaskStore((state) => state.pendingOperations.length);
    const tasks = useTaskStore((state) => state.tasks);
    const isOnline = useOnlineStatus();
    const isMobile = useIsMobile();

    // Short label for the mobile top bar (the section/filter pills move to the
    // bottom nav on mobile, so the bar shows "where am I" instead).
    const mobileTitle = (() => {
        if (currentView === 'habits') return 'Habits';
        if (currentView === 'mail') return 'Mail';
        if (currentView === 'objectives') return 'Objectives';
        const map: Record<string, string> = { active: 'Plan', today: 'Today', upcoming: 'Upcoming', review: 'Review' };
        return map[filter] || 'Tasks';
    })();

    // Today's "plate": outstanding tasks due today-or-earlier, plus anything
    // completed today. Drives the daily progress ring — it fills as you clear
    // Today and "closes" (and fires confetti) when nothing is left.
    const { todayDone, todayTotal } = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
        let done = 0, total = 0;
        for (const t of tasks) {
            if (t.archived || !t.dueDate) continue;
            const due = new Date(t.dueDate).getTime();
            if (due >= endOfToday) continue;
            if (!t.completed) { total++; continue; }
            const c = t.completedAt ? new Date(t.completedAt).getTime() : 0;
            if (c >= startOfToday) { total++; done++; }
        }
        return { todayDone: done, todayTotal: total };
    }, [tasks]);

    const ringCircumference = 2 * Math.PI * 15;
    const ringOffset = todayTotal > 0 ? ringCircumference * (1 - todayDone / todayTotal) : ringCircumference;
    const isLoading = useTaskStore((state) => state.isLoading);
    const { activeTab, setActiveTab } = useMailStore();

    const [isVisible, setIsVisible] = useState(true);
    const hideTimeoutRef = useRef<number | null>(null);

    // Task view menu items
    const taskMenuItems = ['active', 'today', 'upcoming', 'review'] as const;

    // Mail view menu items
    const mailMenuItems = ['inbox', 'to_read', 'to_reply', 'other'] as const;

    // Habit view menu items (tabs within the Habits section)
    const habitMenuItems = [
        { id: 'grid' as const, Label: 'Grid', Icon: LayoutGrid },
        { id: 'checklist' as const, Label: 'Checklist', Icon: ListChecks },
        { id: 'analytics' as const, Label: 'Analytics', Icon: BarChart3 },
    ];

    // Logic to show/hide nav
    const showNav = () => {
        setIsVisible(true);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = window.setTimeout(() => {
            setIsVisible(false);
        }, 3000); // Hide after 3 seconds
    };

    // Show on mount
    useEffect(() => {
        showNav();
        return () => {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
    }, []);

    // Show when the section, filter, or active tab changes
    useEffect(() => {
        showNav();
    }, [filter, activeTab, currentView, habitView]);

    // Show on mouse move near top (optional, or just hover on the bar area)
    const handleMouseEnter = () => {
        setIsVisible(true);
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };

    const handleMouseLeave = () => {
        showNav(); // restart timer
    };

    return (
        <div
            className={`
                fixed top-0 left-0 right-0 z-50 
                flex items-center justify-between
                px-6 py-3
                bg-white/80 dark:bg-slate-900/80 backdrop-blur-md
                border-b border-slate-200 dark:border-slate-800
                transition-opacity duration-700 ease-in-out
                ${(isVisible || isMobile) ? 'opacity-100' : 'opacity-20 hover:opacity-100 grayscale hover:grayscale-0'}
            `}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Left: Logo + persistent Section switcher (the anchor — never moves) */}
            <div className="flex items-center gap-3">
                <Layers className="w-5 h-5 text-primary-600 dark:text-primary-500 shrink-0" />
                {/* Mobile: the section/filter pills live in the bottom nav, so show a
                    simple context title here instead. */}
                <span className="md:hidden text-base font-bold text-slate-800 dark:text-slate-100">{mobileTitle}</span>
                <nav className="hidden md:flex items-center gap-0.5 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
                    {SECTIONS.map(({ id, label, Icon, chord }) => {
                        const isActive = currentView === id;
                        return (
                            <button
                                key={id}
                                onClick={() => { setCurrentView(id); setFocusMode('main'); }}
                                title={`${label} (${chord})`}
                                className={`
                                    flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all
                                    ${isActive
                                        ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600 dark:text-primary-400'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
                                    }
                                `}
                            >
                                <Icon className="w-4 h-4" />
                                <span className="hidden md:inline">{label}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Center: tabs for the CURRENT section (consistent placement for all sections).
                Hidden on mobile — the bottom nav owns section/filter switching there. */}
            <nav className="hidden md:flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg">
                {currentView === 'tasks' && taskMenuItems.map((item) => {
                    const isActive = filter === item;
                    let Icon = Inbox;
                    let Label = 'Plan';
                    if (item === 'today') { Icon = CalendarIcon; Label = 'Today'; }
                    if (item === 'upcoming') { Icon = CalendarClock; Label = 'Upcoming'; }
                    if (item === 'review') { Icon = ClipboardList; Label = 'Review'; }

                    return (
                        <button
                            key={item}
                            onClick={() => { setFilter(item); setFocusMode('main'); }}
                            className={`
                                flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all
                                ${isActive
                                    ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600 dark:text-primary-400'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
                                }
                            `}
                        >
                            <Icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{Label}</span>
                        </button>
                    );
                })}

                {currentView === 'mail' && mailMenuItems.map((item) => {
                    const isActive = activeTab === item;
                    let Icon = Inbox;
                    let Label = 'Inbox';
                    if (item === 'to_read') { Icon = BookOpen; Label = 'To Read'; }
                    if (item === 'to_reply') { Icon = Reply; Label = 'To Reply'; }
                    if (item === 'other') { Icon = Mail; Label = 'Other'; }

                    return (
                        <button
                            key={item}
                            onClick={() => setActiveTab(item)}
                            className={`
                                flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all
                                ${isActive
                                    ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600 dark:text-primary-400'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
                                }
                            `}
                        >
                            <Icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{Label}</span>
                        </button>
                    );
                })}

                {currentView === 'habits' && habitMenuItems.map(({ id, Label, Icon }) => {
                    const isActive = habitView === id;
                    return (
                        <button
                            key={id}
                            onClick={() => setHabitView(id)}
                            className={`
                                flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all
                                ${isActive
                                    ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600 dark:text-primary-400'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
                                }
                            `}
                        >
                            <Icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{Label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* Right: Actions & Status */}
            <div className="flex items-center gap-4">
                {/* Today progress ring */}
                {currentView === 'tasks' && todayTotal > 0 && (
                    <div className="hidden md:flex items-center gap-2" title={`${todayDone} of ${todayTotal} done today`}>
                        <svg width="22" height="22" viewBox="0 0 36 36" className="-rotate-90">
                            <circle cx="18" cy="18" r="15" fill="none" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="4" />
                            <circle
                                cx="18" cy="18" r="15" fill="none"
                                className="stroke-success-500"
                                strokeWidth="4"
                                strokeLinecap="round"
                                strokeDasharray={ringCircumference}
                                strokeDashoffset={ringOffset}
                                style={{ transition: 'stroke-dashoffset 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
                            />
                        </svg>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">{todayDone}/{todayTotal}</span>
                    </div>
                )}

                {/* Search Trigger */}
                <button
                    onClick={() => setCmdOpen(true)}
                    className="hidden lg:flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800"
                >
                    <Command className="w-3 h-3" />
                    <span>Search</span>
                    <kbd className="opacity-50">⌘K</kbd>
                </button>

                {/* Sync Status */}
                {(!isOnline || pendingCount > 0) && (
                    <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md ${!isOnline
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        }`}>
                        {!isOnline ? (
                            <>
                                <WifiOff className="w-3 h-3" />
                                <span className="hidden xl:inline">Offline</span>
                                {pendingCount > 0 && <span className="opacity-70">• {pendingCount}</span>}
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span className="hidden xl:inline">Syncing {pendingCount}...</span>
                            </>
                        )}
                    </div>
                )}

                {/* User & Options */}
                <div className="flex items-center gap-3 border-l border-slate-200 dark:border-slate-800 pl-4">
                    <button title="Shortcuts" onClick={() => setShortcutsOpen(true)} className="hidden md:block text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <Keyboard className="w-4 h-4" />
                    </button>

                    <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 block lg:hidden" title={isGuest ? 'Guest' : session?.user?.email} />
                        <span className="hidden lg:block truncate max-w-[150px]">{isGuest ? 'Guest' : session?.user?.email}</span>
                        <button
                            onClick={async () => {
                                if (isGuest) {
                                    setGuestMode(false);
                                } else {
                                    await supabase.auth.signOut();
                                    // Force reload to clear all stores and ensure clean state
                                    window.location.reload();
                                }
                            }}
                            className="hover:text-red-500 transition-colors"
                            title={isGuest ? 'Exit Guest Mode' : 'Sign Out'}
                        >
                            <UserX className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
