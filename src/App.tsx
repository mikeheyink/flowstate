import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Command, Layers, Inbox, CheckSquare, Archive, Calendar as CalendarIcon, Keyboard, Loader2, AlertCircle, UserX, Wifi, WifiOff, RefreshCw, CalendarClock, ClipboardList } from 'lucide-react';
import { TaskList } from './components/TaskList';
import { WeeklyReview } from './components/WeeklyReview';
import { CommandPalette } from './components/CommandPalette';
import { QuickAdd } from './components/QuickAdd';
import { ShortcutsModal } from './components/ShortcutsModal';
import { Toaster, toast } from './components/Toaster';
import { Login } from './components/Login';
import { TopNav } from './components/TopNav';
import { MobileNav } from './components/MobileNav';
import { InboxZero } from './components/InboxZero';
import { MailView } from './components/Mail/MailView';
import { HabitsView } from './components/Habits/HabitsView';
import { ObjectivesView } from './components/Objectives/ObjectivesView';
import { AdventureView } from './components/Adventure/AdventureView';
import { useTaskStore } from './store/useTaskStore';
import { useHabitStore } from './store/useHabitStore';
import { useObjectiveStore } from './store/useObjectiveStore';
import { useAdventureStore } from './store/useAdventureStore';
import { useUIStore } from './store/useUIStore';
import { useHotkeys } from './hooks/useHotkeys';
import { useOnlineStatus } from './store/useOnlineStatus';
import { celebrate } from './utils/celebrate';
import { getCreationDefaults } from './utils/taskSort';
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
        currentView,
        setCmdOpen,
        setQuickAddOpen,
        setShortcutsOpen,
        setFilter,
        setFocusMode,
        setCurrentView,
        toggleCmd
    } = useUIStore();

    const fetchTasks = useTaskStore((state) => state.fetchTasks);
    const fetchHabits = useHabitStore((state) => state.fetchHabits);
    const fetchObjectives = useObjectiveStore((state) => state.fetchObjectives);
    const objectivePendingCount = useObjectiveStore((state) => state.pendingOperations.length);
    const processObjectivePending = useObjectiveStore((state) => state.processPendingOperations);
    const fetchAdventures = useAdventureStore((state) => state.fetchAdventures);
    const adventurePendingCount = useAdventureStore((state) => state.pendingOperations.length);
    const processAdventurePending = useAdventureStore((state) => state.processPendingOperations);
    const habitPendingCount = useHabitStore((state) => state.pendingOperations.length);
    const processHabitPending = useHabitStore((state) => state.processPendingOperations);
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

    // Guest mode is tracked per-store; keep the habit store in lock-step with the
    // task store so habit log writes actually sync once the user is signed in.
    const setGuestModeBoth = React.useCallback((mode: boolean) => {
        setGuestMode(mode);
        useHabitStore.getState().setGuestMode(mode);
        useObjectiveStore.getState().setGuestMode(mode);
        useAdventureStore.getState().setGuestMode(mode);
    }, [setGuestMode]);

    // Online status for sync indicator
    const isOnline = useOnlineStatus();

    // Inbox Zero Logic - Moved up to avoid "Rendered more hooks" error
    const showInboxZero = React.useMemo(() => {
        if (authLoading) return false;
        if (!session && !isGuest) return false;

        // The "all tasks done" backdrop belongs to the Tasks section only — it must
        // never bleed over Mail or Habits (which have their own empty states).
        if (currentView !== 'tasks') return false;

        // 1. Inbox (Active) View
        if (filter === 'active') {
            return tasks.filter(t => !t.completed && !t.archived).length === 0;
        }

        // 2. Today View
        if (filter === 'today') {
            const now = new Date();
            const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();

            // Check for any outstanding tasks due today or earlier
            const hasOutstanding = tasks.some(t => {
                if (t.completed || t.archived || !t.dueDate) return false;
                const d = new Date(t.dueDate);
                const tDate = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                return tDate < endOfToday;
            });
            return !hasOutstanding;
        }

        return false;
    }, [filter, tasks, authLoading, session, isGuest, currentView]);

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
            if (session) {
                // A real session means we have an authenticated owner — leave guest
                // mode so habit (and task) writes sync to Supabase.
                useHabitStore.getState().setGuestMode(false);
                useObjectiveStore.getState().setGuestMode(false);
                useAdventureStore.getState().setGuestMode(false);
                fetchTasks();
                fetchHabits();
                fetchObjectives();
                fetchAdventures();
            }
        }).catch(err => {
            console.error('Unexpected Auth Error:', err);
            useTaskStore.getState().setError('Unexpected authentication error occurred');
        }).finally(() => {
            setAuthLoading(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            setSession(session);
            if (session) {
                useHabitStore.getState().setGuestMode(false);
                useObjectiveStore.getState().setGuestMode(false);
                useAdventureStore.getState().setGuestMode(false);
                fetchTasks();
                fetchHabits();
                fetchObjectives();
                fetchAdventures();
            }
            setAuthLoading(false);

            // Global Handler: Capture Google Refresh Token if present (e.g. after OAuth redirect)
            if (event === 'SIGNED_IN' && session?.provider_refresh_token) {
                console.log('Capturing Google Refresh Token globally...');
                const { error } = await supabase
                    .from('google_tokens')
                    .upsert({
                        user_id: session.user.id,
                        refresh_token: session.provider_refresh_token,
                        updated_at: new Date().toISOString()
                    });

                if (error) console.error('Failed to save refresh token:', error);
                else console.log('Refresh token saved securely.');
            }
        });

        return () => subscription.unsubscribe();
    }, [fetchTasks, fetchHabits, fetchObjectives, fetchAdventures]);

    // Celebrate the milestone: fire one subtle confetti burst the moment the
    // list goes from "has tasks" to "all done" (Today cleared / Inbox Zero).
    // sawTasksRef gates out the "opened the app already-empty" case so the
    // burst stays rare — it only fires after we've actually seen a non-empty list.
    const prevInboxZeroRef = useRef(false);
    const sawTasksRef = useRef(false);
    useEffect(() => {
        if (!showInboxZero) {
            sawTasksRef.current = true;
        } else if (sawTasksRef.current && !prevInboxZeroRef.current) {
            celebrate();
        }
        prevInboxZeroRef.current = showInboxZero;
    }, [showInboxZero]);

    // Process pending operations when back online
    useEffect(() => {
        if (isOnline && pendingCount > 0 && !isGuest) {
            processPendingOperations();
        }
    }, [isOnline, pendingCount, isGuest, processPendingOperations]);

    // Replay any queued habit operations once we're back online. We intentionally
    // do NOT gate on the task store's `isGuest` here (the two stores' guest flags
    // can diverge, and that gate could strand a signed-in user's queue).
    // processHabitPending() validates the authenticated user internally, and guest
    // sessions never accrue habit ops in the first place — so this is safe.
    useEffect(() => {
        if (isOnline && habitPendingCount > 0) {
            processHabitPending();
        }
    }, [isOnline, habitPendingCount, processHabitPending]);

    // Same replay path for queued objective writes.
    useEffect(() => {
        if (isOnline && objectivePendingCount > 0) {
            processObjectivePending();
        }
    }, [isOnline, objectivePendingCount, processObjectivePending]);

    // ...and for queued adventure writes.
    useEffect(() => {
        if (isOnline && adventurePendingCount > 0) {
            processAdventurePending();
        }
    }, [isOnline, adventurePendingCount, processAdventurePending]);

    // Daily soft-start: the first open of each day lands on Objectives — the
    // one values-touchpoint of the day. Any key or tap dismisses to Today.
    const softStartActive = useUIStore((s) => s.softStartActive);
    useEffect(() => {
        if (authLoading) return;
        if (!session && !isGuest) return; // only once the app proper is visible
        // Guests never run fetchObjectives, so make sure the five defaults exist
        // before the soft-start tries to render them. For a signed-in user this
        // is a no-op until the fetch has landed — seeding ahead of the DB is
        // what used to leave the page with two of every objective.
        useObjectiveStore.getState().seedIfEmpty();
        useObjectiveStore.getState().dedupeSeedDuplicates();
        useAdventureStore.getState().seedIfEmpty();
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const ui = useUIStore.getState();
        if (ui.lastSoftStartDate !== today) {
            ui.beginSoftStart(today);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, session, isGuest]);

    useEffect(() => {
        if (!softStartActive) return;
        // Capture phase + stopPropagation: the dismissing key/tap must not also
        // trigger hotkeys or focus handlers underneath. We arm the listeners
        // after a short delay so the very interaction that opened the app (the
        // login click, or a keypress still settling) can't instantly dismiss it.
        const dismiss = (e: Event) => {
            e.stopPropagation();
            if (e instanceof KeyboardEvent) e.preventDefault();
            useUIStore.getState().dismissSoftStart();
        };
        const armAt = window.setTimeout(() => {
            window.addEventListener('keydown', dismiss, { capture: true });
            window.addEventListener('pointerdown', dismiss, { capture: true });
        }, 500);
        return () => {
            window.clearTimeout(armAt);
            window.removeEventListener('keydown', dismiss, { capture: true });
            window.removeEventListener('pointerdown', dismiss, { capture: true });
        };
    }, [softStartActive]);

    // Keyboard Shortcuts (Centralized Hook)
    useHotkeys();

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
                            onClick={() => { setGuestModeBoth(true); fetchTasks(); }}
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
        <div className="h-dvh w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 flex flex-col md:flex-row font-sans selection:bg-primary-500/30">
            {/* Top Navigation Bar */}
            <TopNav session={session} isGuest={isGuest} setGuestMode={setGuestModeBoth} />

            {/* Main Content */}
            <main className="flex-1 overflow-hidden flex flex-col relative bg-slate-50 dark:bg-slate-950 pt-16">

                <div
                    onClick={() => {
                        setFocusMode('main');
                        // Deselect if clicking whitespace
                        useTaskStore.getState().setFocusedId(null);
                    }}
                    className="flex-1 overflow-hidden relative"
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentView}
                            initial={{ x: currentView === 'mail' || currentView === 'habits' || currentView === 'adventure' ? '100%' : '-100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: currentView === 'mail' || currentView === 'habits' || currentView === 'adventure' ? '-100%' : '100%', opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="absolute inset-0 overflow-y-auto px-4 pt-6 pb-24 md:px-8 md:py-6 scroll-smooth"
                        >
                            {currentView === 'tasks' ? (
                                <div className="max-w-5xl mx-auto">
                                    {filter === 'review' ? <WeeklyReview /> : <TaskList filter={filter} />}
                                </div>
                            ) : currentView === 'mail' ? (
                                <div className="max-w-5xl mx-auto h-full">
                                    <MailView />
                                </div>
                            ) : currentView === 'objectives' ? (
                                <ObjectivesView />
                            ) : currentView === 'adventure' ? (
                                <AdventureView />
                            ) : (
                                <HabitsView />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Floating Quick Add Input */}
                <QuickAdd isOpen={isQuickAddOpen} onClose={() => setQuickAddOpen(false)} />

                {/* Mobile FAB — context-aware: adds a task in Tasks, a habit in Habits, hidden in Mail */}
                <button
                    onClick={() => {
                        if (currentView === 'habits') {
                            useUIStore.getState().openNewHabit();
                            return;
                        }
                        if (currentView === 'adventure') {
                            useAdventureStore.getState().addAdventure();
                            return;
                        }
                        // Only treat the focused id as a parent when it's a real task.
                        // In views like Review the "focus" can be a section header
                        // (e.g. a week group), which would orphan the new task.
                        const { focusedId, tasks } = useTaskStore.getState();
                        const focusedTask = focusedId ? tasks.find(t => t.id === focusedId) ?? null : null;
                        const parentId = focusedTask ? focusedTask.id : null;
                        // Same context inheritance as Enter: today in Today, the
                        // focused task's day in Upcoming, plus its importance.
                        const defaults = getCreationDefaults(filter, focusedTask);
                        setQuickAddOpen(true, parentId, 'create', null, defaults);
                    }}
                    className={`${(currentView === 'mail' || currentView === 'objectives') ? 'hidden' : 'md:hidden'} fixed bottom-20 right-5 w-14 h-14 bg-primary-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-primary-500 active:scale-95 transition-all z-40`}
                    aria-label={currentView === 'habits' ? 'Add Habit' : currentView === 'adventure' ? 'Plant Adventure Seed' : 'Add Task'}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
            </main>

            {/* Mobile bottom navigation (md:hidden — desktop is unchanged) */}
            <MobileNav />

            {/* Modals & Overlays */}
            <InboxZero show={showInboxZero} />
            <CommandPalette isOpen={isCmdOpen} onClose={() => setCmdOpen(false)} />
            <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setShortcutsOpen(false)} />
            <Toaster />
        </div>
    );
}

export default App;