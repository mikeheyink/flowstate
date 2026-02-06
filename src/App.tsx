import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Command, Layers, Inbox, CheckSquare, Archive, Calendar as CalendarIcon, Keyboard, Loader2, AlertCircle, UserX, Wifi, WifiOff, RefreshCw, CalendarClock, ClipboardList } from 'lucide-react';
import { TaskList } from './components/TaskList';
import { WeeklyReview } from './components/WeeklyReview';
import { CommandPalette } from './components/CommandPalette';
import { CoachChat } from './components/CoachChat';
import { QuickAdd } from './components/QuickAdd';
import { ShortcutsModal } from './components/ShortcutsModal';
import { Toaster, toast } from './components/Toaster';
import { Login } from './components/Login';
import { TopNav } from './components/TopNav';
import { InboxZero } from './components/InboxZero';
import { MailView } from './components/Mail/MailView';
import { useTaskStore } from './store/useTaskStore';
import { useUIStore } from './store/useUIStore';
import { useHotkeys } from './hooks/useHotkeys';
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

    // Inbox Zero Logic - Moved up to avoid "Rendered more hooks" error
    const showInboxZero = React.useMemo(() => {
        if (authLoading) return false;
        if (!session && !isGuest) return false;

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
    }, [filter, tasks, authLoading, session, isGuest]);

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
        } = supabase.auth.onAuthStateChange(async (event, session) => {
            setSession(session);
            if (session) fetchTasks();
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
    }, [fetchTasks]);

    // Process pending operations when back online
    useEffect(() => {
        if (isOnline && pendingCount > 0 && !isGuest) {
            processPendingOperations();
        }
    }, [isOnline, pendingCount, isGuest, processPendingOperations]);

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
        <div className="h-dvh w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 flex flex-col md:flex-row font-sans selection:bg-primary-500/30">
            {/* Top Navigation Bar */}
            <TopNav session={session} isGuest={isGuest} setGuestMode={setGuestMode} />

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
                            initial={{ x: currentView === 'mail' ? '100%' : '-100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: currentView === 'mail' ? '-100%' : '100%', opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="absolute inset-0 overflow-y-auto px-4 py-6 md:px-8 scroll-smooth"
                        >
                            {currentView === 'tasks' ? (
                                <div className="max-w-5xl mx-auto">
                                    {filter === 'review' ? <WeeklyReview /> : <TaskList filter={filter} />}
                                </div>
                            ) : (
                                <div className="max-w-5xl mx-auto h-full">
                                    <MailView />
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
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
            {/* Modals & Overlays */}
            <InboxZero show={showInboxZero} />
            <CommandPalette isOpen={isCmdOpen} onClose={() => setCmdOpen(false)} />
            <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setShortcutsOpen(false)} />
            <CoachChat />
            <Toaster />
        </div>
    );
}

export default App;