import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '../store/useUIStore';
import { useTaskStore } from '../store/useTaskStore';
import { useMailStore, filterEmails } from '../store/useMailStore';
import { toast } from '../components/Toaster';
import { useHabitStore } from '../store/useHabitStore';

export function useHotkeys() {
    const {
        currentView,
        setCurrentView,
        isCmdOpen,
        isQuickAddOpen,
        isShortcutsOpen,
        setCmdOpen,
        setQuickAddOpen,
        setShortcutsOpen,
        toggleCmd,
        setFilter,
        focusMode,
    } = useUIStore();

    const {
        undo,
        redo,
        batchAddTasks,
        focusedId,
    } = useTaskStore();

    const {
        selectedId,
        focusedIndex,
        setSelectedId,
        setFocusedIndex,
        emails,
        activeTab,
        setActiveTab,
        navigateEmail
        // navigateEmail is an action, but we'll call it via getState() to ensure it's the latest
    } = useMailStore();

    // Internal state for G-chord (G -> Key)
    const [gPressed, setGPressed] = useState(false);
    const gTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // 1. Global Ignore Rules
            if (
                document.activeElement?.tagName === 'INPUT' ||
                document.activeElement?.tagName === 'TEXTAREA'
            ) {
                if (e.key === 'Escape') (document.activeElement as HTMLElement).blur();
                return;
            }

            const key = e.key.toLowerCase();
            const isCmd = e.metaKey || e.ctrlKey;
            const isShift = e.shiftKey;
            const isAlt = e.altKey;

            // Access latest state directly
            const uiState = useUIStore.getState();
            const taskState = useTaskStore.getState();
            const mailState = useMailStore.getState();

            // ----------------------------------------------------------------
            // GLOBAL HOTKEYS (Application-wide)
            // ----------------------------------------------------------------

            // Shortcuts Modal (?)
            if (key === '?' && !isCmd) {
                setShortcutsOpen(true);
                return;
            }
            if (key === 'escape') {
                if (uiState.isShortcutsOpen) setShortcutsOpen(false);
                if (uiState.isCmdOpen) setCmdOpen(false);
                if (uiState.isQuickAddOpen) setQuickAddOpen(false);
                return;
            }

            // Command Palette (Cmd+K)
            if (isCmd && key === 'k') {
                e.preventDefault();
                toggleCmd();
                return;
            }

            // View Switching ([ and ] cycle through Tasks → Mail → Habits)
            if ((key === '[' || key === ']') && !isCmd && !isShift && !isAlt) {
                e.preventDefault();
                const views = ['tasks', 'mail', 'habits'] as const;
                const currentIdx = views.indexOf(uiState.currentView as any);
                let nextIdx: number;

                if (key === ']') {
                    nextIdx = (currentIdx + 1) % views.length;
                } else {
                    nextIdx = (currentIdx - 1 + views.length) % views.length;
                }

                const nextView = views[nextIdx];
                setCurrentView(nextView);
                const labels = { tasks: 'Tasks', mail: 'Mail', habits: 'Habits' };
                toast(`Switch to ${labels[nextView]}`);
                return;
            }

            // Undo/Redo
            if (isCmd && key === 'z') {
                e.preventDefault();
                if (isShift) redo();
                else undo();
                return;
            }
            if (isCmd && key === 'y') {
                e.preventDefault();
                redo();
                return;
            }

            // Batch Paste
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

            // G-Chord Navigation (Global)
            if (key === 'g' && !isCmd && !gPressed) {
                setGPressed(true);
                if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current);
                gTimeoutRef.current = window.setTimeout(() => setGPressed(false), 500);
                return;
            }

            if (gPressed) {
                if (key === 'i' && uiState.currentView === 'tasks') { setFilter('active'); toast("Go to Inbox"); setGPressed(false); return; }
                if (key === 't' && uiState.currentView === 'tasks') { setFilter('today'); toast("Go to Today"); setGPressed(false); return; }
                if (key === 'r' && uiState.currentView === 'tasks') { setFilter('review'); toast("Go to Review"); setGPressed(false); return; }
                if (key === 'h') { setCurrentView(uiState.currentView === 'habits' ? 'tasks' : 'habits'); toast(uiState.currentView === 'habits' ? 'Back to Tasks' : 'Go to Habits'); setGPressed(false); return; }
                setGPressed(false);
                return;
            }

            // ----------------------------------------------------------------
            // TASK VIEW HOTKEYS
            // ----------------------------------------------------------------
            if (uiState.currentView === 'tasks') {

                // Quick Add
                if (key === 'enter' && !isCmd && !isAlt && !isShift) {
                    e.preventDefault();
                    // Context-aware add
                    if (taskState.focusedId && uiState.focusMode === 'main') {
                        const task = taskState.tasks.find(t => t.id === taskState.focusedId);
                        if (task) {
                            setQuickAddOpen(true, task.parentId || null, 'create', taskState.focusedId);
                            return;
                        }
                    }
                    setQuickAddOpen(true);
                    return;
                }

                // Sidebar Cycle (PageUp/Down) - TASKS
                if (key === 'pagedown' || key === ']') {
                    e.preventDefault();
                    const currentFilter = uiState.filter;
                    const items = ['active', 'today', 'upcoming', 'review'] as const;
                    const idx = items.indexOf(currentFilter as any);
                    const nextIndex = (idx + 1) % items.length;
                    setFilter(items[nextIndex]);
                    return;
                }
                if (key === 'pageup' || key === '[') {
                    e.preventDefault();
                    const currentFilter = uiState.filter;
                    const items = ['active', 'today', 'upcoming', 'review'] as const;
                    const idx = items.indexOf(currentFilter as any);
                    const nextIndex = (idx - 1 + items.length) % items.length;
                    setFilter(items[nextIndex]);
                    return;
                }
            }

            // ----------------------------------------------------------------
            // HABITS VIEW HOTKEYS
            // ----------------------------------------------------------------
            if (uiState.currentView === 'habits') {
                // View cycling is handled by the HabitsView component
                // Hotkeys here are for global actions
            }

            // ----------------------------------------------------------------
            // MAIL VIEW HOTKEYS
            // ----------------------------------------------------------------
            if (uiState.currentView === 'mail') {

                // Sidebar Cycle (PageUp/Down) - MAIL
                if (key === 'pagedown' || key === ']') {
                    e.preventDefault();
                    const currentTab = mailState.activeTab;
                    const items = ['inbox', 'to_read', 'to_reply', 'other'] as const;
                    const idx = items.indexOf(currentTab);
                    const nextIndex = (idx + 1) % items.length;
                    setActiveTab(items[nextIndex]);
                    return;
                }
                if (key === 'pageup' || key === '[') {
                    e.preventDefault();
                    const currentTab = mailState.activeTab;
                    const items = ['inbox', 'to_read', 'to_reply', 'other'] as const;
                    const idx = items.indexOf(currentTab);
                    const nextIndex = (idx - 1 + items.length) % items.length;
                    setActiveTab(items[nextIndex]);
                    return;
                }

                // Navigation (Arrows) - Strict Logic
                if (key === 'arrowdown') {
                    e.preventDefault();
                    const filtered = filterEmails(mailState.emails, mailState.activeTab);
                    if (filtered.length === 0) return;

                    const nextIndex = Math.min(mailState.focusedIndex + 1, filtered.length - 1);

                    // Atomic update
                    if (filtered[nextIndex]) {
                        // Direct store call, no closure staleness
                        mailState.navigateEmail(nextIndex, filtered[nextIndex].id);
                    }
                    return;
                }
                if (key === 'arrowup') {
                    e.preventDefault();
                    // Logic: If index > 0, decrement.
                    // If index is 0, stay at 0.
                    const filtered = filterEmails(mailState.emails, mailState.activeTab);
                    if (filtered.length === 0) return;

                    const prevIndex = Math.max(mailState.focusedIndex - 1, 0);

                    if (filtered[prevIndex]) {
                        mailState.navigateEmail(prevIndex, filtered[prevIndex].id);
                    }
                    return;
                }

                // Actions
                if (key === 'x') {
                    e.preventDefault();
                    console.log('Archive action triggered (Hook)');
                    // if (mailState.selectedId) archiveEmail(mailState.selectedId);
                }
                if (key === 'r' && !isCmd) {
                    e.preventDefault();
                    console.log('Mark Read (Hook)');
                }
                if (key === 'y') {
                    e.preventDefault();
                    console.log('Mark Reply (Hook)');
                }
            }

        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        // Dependencies are now just the stable setters, or minimal values.
        // Actually, since we use getState(), we don't strictly need *any* value deps for logic,
        // but stable function refs (undo, redo, etc) are fine.
        undo, redo, batchAddTasks,
        setCurrentView, setShortcutsOpen, setCmdOpen, setQuickAddOpen, toggleCmd,
        setFilter, setSelectedId, setFocusedIndex, setActiveTab,
        gPressed
    ]);
}
