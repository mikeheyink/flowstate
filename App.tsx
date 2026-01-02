import React, { useEffect, useState, useRef } from 'react';
import { Command, Layers, Inbox, CheckSquare, Archive, Calendar as CalendarIcon, Keyboard, Loader2, AlertCircle, UserX, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { TaskList } from './components/TaskList';
import { CommandPalette } from './components/CommandPalette';
import { QuickAdd } from './components/QuickAdd';
import { ShortcutsModal } from './components/ShortcutsModal';
import { Toaster, toast } from './components/Toaster';
import { Login } from './components/Login';
import { useTaskStore } from './store/useTaskStore';
import { useUIStore } from './store/useUIStore';
import { useOnlineStatus } from './store/useOnlineStatus';
import { supabase } from './utils/supabase';

function App() {
    const [session, setSession] = useState<any>(null);
    const [authLoading, setAuthLoading] = useState(true);

    const {
        isCmdOpen,
        isQuickAddOpen,
        isShortcutsOpen,
        filter,
        focusMode,
        setCmdOpen,
        setQuickAddOpen,
        setShortcutsOpen,
        setFilter,
        setFocusMode,
        toggleCmd
    } = useUIStore();

    const fetchTasks = useTaskStore((state) => state.fetchTasks);
    const undo = useTaskStore((state) => state.undo);
    const redo = useTaskStore((state) => state.redo);
    const batchAddTasks = useTaskStore((state) => state.batchAddTasks);
    const tasks = useTaskStore((state) => state.tasks);
    const focusedId = useTaskStore((state) => state.focusedId);
    const isLoading = useTaskStore((state) => state.isLoading);
    const error = useTaskStore((state) => state.error);

    // Fix: Map guestMode from store to isGuest variable used in component
    const isGuest = useTaskStore((state) => state.guestMode);
    const setGuestMode = useTaskStore((state) => state.setGuestMode);
    const pendingCount = useTaskStore((state) => state.pendingOperations.length);
    const processPendingOperations = useTaskStore((state) => state.processPendingOperations);

    // Online status for sync indicator
    const isOnline = useOnlineStatus();

    // Sidebar selection state
    const menuItems = ['active', 'today', 'completed', 'all'] as const;
    const [sidebarIndex, setSidebarIndex] = useState(0);

    // G-chord state
    const [gPressed, setGPressed] = useState(false);
    const gTimeoutRef = useRef<number | null>(null);

    // Auth & Data Init
    useEffect(() => {
        // Check for error parameters in the URL (OAuth redirect errors)
        const params = new URLSearchParams(window.location.search);
        const errorParam = params.get('error');
        const errorDesc = params.get('error_description');

        if (errorParam) {
            console.error('OAuth Error:', errorParam, errorDesc);
            useTaskStore.getState().setError(`Authentication Error: ${errorDesc || errorParam}`);
            setAuthLoading(false);
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }

        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (error) {
                console.error('Session Error:', error);
                useTaskStore.getState().setError(error.message);
            }
            setSession(session);
            if (session) fetchTasks();
        }).catch(err => {
            console.error('Unexpected Auth Error:', err);
            useTaskStore.getState().setError('Unexpected authentication error occurred');
        }).finally(() => {
            setAuthLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) fetchTasks();
            // Ensure loading is false on change events too
            setAuthLoading(false);
        });

        return () => subscription.unsubscribe();
    }, [fetchTasks]);

    // Sync sidebar index with current filter
    useEffect(() => {
        const idx = menuItems.indexOf(filter);
        if (idx !== -1) setSidebarIndex(idx);
    }, [filter]);

    // Process pending operations when back online
    useEffect(() => {
        if (isOnline && pendingCount > 0 && !isGuest) {
            processPendingOperations();
        }
    }, [isOnline, pendingCount, isGuest, processPendingOperations]);

    // Global Hotkeys
    useEffect(() => {
        if (!session && !isGuest) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // 1. Inputs Check
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
                // Allow Escape to blur inputs
                if (e.key === 'Escape') (document.activeElement as HTMLElement).blur();
                return;
            }

            const key = e.key.toLowerCase();
            const isCmd = e.metaKey || e.ctrlKey;
            const isShift = e.shiftKey;

            // Shortcuts Modal (?)
            if (key === '?') {
                setShortcutsOpen(true);
                return;
            }
            if (key === 'escape' && isShortcutsOpen) {
                setShortcutsOpen(false);
                return;
            }

            // Cmd+Shift+V (Batch Paste)
            if (isCmd && isShift && key === 'v') {
                e.preventDefault();
                navigator.clipboard.readText().then(text => {
                    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                    if (lines.length > 0) {
                        batchAddTasks(lines);
                        toast(`Created ${lines.length} tasks from clipboard`);
                    }
                });
                return;
            }

            // Command Palette (Cmd+K)
            if (isCmd && key === 'k') {
                e.preventDefault();
                toggleCmd();
                return;
            }

            // Quick Add (New Task)
            if (key === 'enter' && !isCmd) {
                e.preventDefault();
                // Check if we are focused on a task to insert after it
                if (focusedId && focusMode === 'main') {
                    const task = tasks.find(t => t.id === focusedId);
                    if (task) {
                        setQuickAddOpen(true, task.parentId || null, 'create', focusedId);
                        return;
                    }
                }
                setQuickAddOpen(true);
                return;
            }

            // G-Chord Navigation
            if (key === 'g' && !isCmd && !gPressed) {
                setGPressed(true);
                if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current);
                gTimeoutRef.current = window.setTimeout(() => setGPressed(false), 500);
                return;
            }

            // Global Sidebar Nav (PageUp / PageDown)
            if (key === 'pagedown') {
                e.preventDefault();
                const nextIndex = (sidebarIndex + 1) % menuItems.length;
                setSidebarIndex(nextIndex);
                setFilter(menuItems[nextIndex]);
                return;
            }
            if (key === 'pageup') {
                e.preventDefault();
                const nextIndex = (sidebarIndex - 1 + menuItems.length) % menuItems.length;
                setSidebarIndex(nextIndex);
                setFilter(menuItems[nextIndex]);
                return;
            }

            if (gPressed) {
                if (key === 'i') { setFilter('active'); toast("Go to Inbox"); }
                if (key === 't') { setFilter('today'); toast("Go to Today"); }
                if (key === 'a') { setFilter('all'); }
                setGPressed(false);
                return;
            }

            // Sidebar Nav
            if (focusMode === 'sidebar') {
                if (key === 'arrowdown') {
                    e.preventDefault();
                    const nextIndex = (sidebarIndex + 1) % menuItems.length;
                    setSidebarIndex(nextIndex);
                    setFilter(menuItems[nextIndex]);
                } else if (key === 'arrowup') {
                    e.preventDefault();
                    const nextIndex = (sidebarIndex - 1 + menuItems.length) % menuItems.length;
                    setSidebarIndex(nextIndex);
                    setFilter(menuItems[nextIndex]);
                } else if (key === 'enter') {
                    e.preventDefault();
                    setFocusMode('main');
                } else if (key === 'arrowright' || key === 'l') {
                    e.preventDefault();
                    setFocusMode('main');
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [session, isGuest, isCmdOpen, isQuickAddOpen, undo, redo, toggleCmd, setQuickAddOpen, focusMode, sidebarIndex, menuItems, setFilter, setFocusMode, gPressed, isShortcutsOpen, setShortcutsOpen, batchAddTasks, tasks, focusedId]);

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        )
    }

    // Allow render if Session OR Guest Mode
    if (!session && !isGuest) {
        return <Login />;
    }

    // Error State for DB connection issues (Only show if NOT guest)
    if (error && !isGuest) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 text-center">
                <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/50 p-6 rounded-xl shadow-xl max-w-lg w-full">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 mb-4 mx-auto">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Database Connection Error</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">{error}</p>

                    {(error.includes('relation "tasks" does not exist') || error.includes('42P01')) && (
                        <div className="text-left bg-slate-50 dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800 p-4 mb-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Action Required</p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                                The <code>tasks</code> table is missing in your Supabase project.
                            </p>
                            <p className="text-xs text-slate-500">Go to Supabase SQL Editor and run the creation script provided.</p>
                        </div>
                    )}

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => { fetchTasks(); window.location.reload(); }}
                            className="w-full py-2.5 rounded-lg bg-primary-600 hover:bg-primary-500 text-white font-medium transition-colors"
                        >
                            Retry Connection
                        </button>
                        <button
                            onClick={() => { setGuestMode(true); fetchTasks(); }}
                            className="text-xs text-slate-500 hover:text-slate-400"
                        >
                            Ignore and use Guest Mode
                        </button>
                    </div>
                </div>
                <div className="mt-8 text-xs text-slate-400">
                    Logged in as {session?.user?.email} • <button onClick={() => supabase.auth.signOut()} className="underline hover:text-slate-300">Sign Out</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 flex flex-col md:flex-row font-sans selection:bg-primary-500/30">
            {/* Sidebar / Mobile Header */}
            <aside
                className={`
            w-full md:w-64 bg-white dark:bg-slate-900/50 
            border-b md:border-b-0 md:border-r 
            flex flex-row md:flex-col 
            items-center md:items-stretch
            px-4 py-3 md:pt-6 md:pb-4 
            transition-colors duration-200 shrink-0
            ${focusMode === 'sidebar' ? 'border-primary-500/50 ring-1 ring-inset ring-primary-500/20' : 'border-slate-200 dark:border-slate-800/50'}
        `}
            >
                <div className="flex items-center gap-2 mr-4 md:mr-0 md:px-6 md:mb-8">
                    <Layers className="w-5 h-5 md:w-6 md:h-6 text-primary-600 dark:text-primary-500" />
                    <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 hidden sm:block">FlowState</h1>
                </div>

                <nav className="flex-1 flex flex-row md:flex-col gap-1 md:gap-0 md:space-y-1 overflow-x-auto md:overflow-visible no-scrollbar mask-linear-fade md:mask-none px-2 md:px-3">
                    {menuItems.map((item, index) => {
                        const isActive = filter === item;
                        const isFocused = focusMode === 'sidebar' && sidebarIndex === index;

                        let Icon = Inbox;
                        let Label = 'Inbox';
                        if (item === 'completed') { Icon = CheckSquare; Label = 'Done'; }
                        if (item === 'all') { Icon = Archive; Label = 'All'; }
                        if (item === 'today') { Icon = CalendarIcon; Label = 'Today'; }

                        return (
                            <button
                                key={item}
                                onClick={() => {
                                    setFilter(item);
                                    setFocusMode('sidebar');
                                    setSidebarIndex(index);
                                }}
                                className={`
                            flex items-center gap-2 px-3 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-all relative shrink-0
                            ${isActive ? 'bg-slate-100 dark:bg-slate-800 text-primary-600 dark:text-primary-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'}
                            ${isFocused ? 'ring-1 ring-primary-500 bg-slate-100 dark:bg-slate-800/80 text-primary-600 dark:text-primary-300' : ''}
                        `}
                            >
                                {isFocused && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 md:h-5 bg-primary-500 rounded-r-full hidden md:block" />}
                                <Icon className="w-4 h-4" />
                                <span className={item === 'active' ? '' : 'hidden sm:inline'}>{Label}</span>
                            </button>
                        );
                    })}
                </nav>

                <div className="ml-2 md:ml-0 md:px-6 md:mt-auto flex flex-col gap-2 shrink-0 border-l md:border-l-0 pl-3 md:pl-0 border-slate-200 dark:border-slate-800">
                    {/* Sync Status Indicator - Only visible when offline or pending */}
                    {(!isOnline || pendingCount > 0) && (
                        <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md ${!isOnline
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            }`}>
                            {!isOnline ? (
                                <>
                                    <WifiOff className="w-3 h-3" />
                                    <span>Offline</span>
                                    {pendingCount > 0 && <span className="opacity-70">• {pendingCount}</span>}
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    <span>Syncing {pendingCount}...</span>
                                </>
                            )}
                        </div>
                    )}
                    <div className="text-xs text-slate-400 flex items-center gap-2 md:justify-between">
                        <span className="w-2 h-2 rounded-full bg-green-500 block md:hidden" title={isGuest ? 'Guest' : session?.user?.email} />
                        <span className="hidden md:block truncate max-w-[100px]">{isGuest ? 'Guest' : session?.user?.email}</span>
                        <button
                            onClick={() => {
                                if (isGuest) setGuestMode(false);
                                else supabase.auth.signOut();
                            }}
                            className="hover:text-red-400"
                        >
                            <span className="hidden md:inline">{isGuest ? 'Exit' : 'Sign Out'}</span>
                            <UserX className="w-4 h-4 md:hidden" />
                        </button>
                    </div>
                    <button onClick={() => setShortcutsOpen(true)} className="hidden md:flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200">
                        <Keyboard className="w-3 h-3" /> Shortcuts (?)
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 h-screen overflow-hidden flex flex-col relative bg-slate-50 dark:bg-slate-950">
                <header className="h-16 border-b border-slate-200 dark:border-slate-800/50 flex items-center px-8 justify-between shrink-0 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm z-10">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 capitalize flex items-center gap-2">
                        {filter === 'active' ? 'Inbox' : filter}
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                    </h2>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setCmdOpen(true)}
                            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                        >
                            <Command className="w-3 h-3" />
                            <span>Search...</span>
                            <kbd className="font-sans text-[10px] ml-2 opacity-50">⌘K</kbd>
                        </button>
                    </div>
                </header>

                <div
                    onClick={() => {
                        setFocusMode('main');
                        // Deselect if clicking whitespace
                        useTaskStore.getState().setFocusedId(null);
                    }}
                    className={`flex-1 overflow-y-auto px-4 py-6 md:px-8 scroll-smooth transition-opacity duration-200 ${focusMode === 'sidebar' ? 'md:opacity-50' : 'opacity-100'}`}
                >
                    <div className="max-w-3xl mx-auto">
                        <TaskList filter={filter} />
                    </div>
                </div>

                {/* Floating Quick Add Input */}
                <QuickAdd isOpen={isQuickAddOpen} onClose={() => setQuickAddOpen(false)} />

                {/* Mobile FAB */}
                <button
                    onClick={() => {
                        const focusedId = useTaskStore.getState().focusedId;
                        if (focusedId) {
                            setQuickAddOpen(true, focusedId);
                        } else {
                            setQuickAddOpen(true);
                        }
                    }}
                    className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-primary-500 active:scale-95 transition-all z-40"
                    aria-label="Add Task"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
            </main>

            {/* Modals & Overlays */}
            <CommandPalette isOpen={isCmdOpen} onClose={() => setCmdOpen(false)} />
            <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setShortcutsOpen(false)} />
            <Toaster />
        </div>
    );
}

export default App;