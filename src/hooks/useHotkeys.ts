import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '../store/useUIStore';
import { useTaskStore } from '../store/useTaskStore';
import { useMailStore, filterEmails } from '../store/useMailStore';
import { toast } from '../components/Toaster';
import { useHabitStore } from '../store/useHabitStore';
import { setGChordPending, markKeyConsumed } from '../utils/keyChord';

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

            // Escape always closes whatever overlay is open (handled here so it
            // works even when focus isn't in an input — e.g. the habit form).
            if (key === 'escape') {
                if (uiState.isShortcutsOpen) setShortcutsOpen(false);
                if (uiState.isCmdOpen) setCmdOpen(false);
                if (uiState.isQuickAddOpen) setQuickAddOpen(false);
                if (uiState.habitForm.open) uiState.closeHabitForm();
                return;
            }

            // While a modal/overlay owns the screen, swallow all other shortcuts so
            // section/grid navigation can't fire "behind" it. (The overlay handles
            // its own keys: ⌘K toggles the palette, the form captures typing, etc.)
            if (uiState.isAnyOverlayOpen()) {
                if (isCmd && key === 'k') { e.preventDefault(); toggleCmd(); }
                return;
            }

            // Shortcuts Modal (?)
            if (key === '?' && !isCmd) {
                setShortcutsOpen(true);
                return;
            }

            // Command Palette (Cmd+K)
            if (isCmd && key === 'k') {
                e.preventDefault();
                toggleCmd();
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

            // Section switching (⌘[ / ⌘]) — previous / next top-level section.
            // ⌘[ / ⌘] are Back/Forward in Chrome/Safari but are interceptable;
            // preventDefault stops the browser navigating history.
            if (isCmd && (key === '[' || key === ']')) {
                e.preventDefault();
                const sections = ['objectives', 'tasks', 'habits', 'adventure'] as const;
                const labels: Record<string, string> = { tasks: 'Tasks', habits: 'Habits', objectives: 'Objectives', adventure: 'Adventure' };
                const cur = Math.max(0, sections.indexOf(uiState.currentView as any));
                const next = key === ']'
                    ? (cur + 1) % sections.length
                    : (cur - 1 + sections.length) % sections.length;
                setCurrentView(sections[next]);
                toast(labels[sections[next]]);
                return;
            }

            // G-Chord Navigation (Global)
            // The shared pending/consumed flags (keyChord.ts) stop the chord's
            // second key from also firing single-letter task actions (u/i).
            if (key === 'g' && !isCmd && !gPressed) {
                setGPressed(true);
                setGChordPending(true);
                if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current);
                gTimeoutRef.current = window.setTimeout(() => {
                    setGPressed(false);
                    setGChordPending(false);
                }, 500);
                return;
            }

            // G-chord resolves: jump to any section (and a specific tab for Tasks).
            // This is the ONE way to move between sections — always two keys, always
            // the same verb ("go to"), so it never collides with [ / ] tab cycling.
            if (gPressed) {
                setGPressed(false);
                setGChordPending(false);
                markKeyConsumed(e);
                if (key === 'i') { setCurrentView('tasks'); setFilter('active'); toast('Tasks · Plan'); }
                else if (key === 't') { setCurrentView('tasks'); setFilter('today'); toast('Tasks · Today'); }
                else if (key === 'u') { setCurrentView('tasks'); setFilter('upcoming'); toast('Tasks · Upcoming'); }
                else if (key === 'r') { setCurrentView('tasks'); setFilter('review'); toast('Tasks · Review'); }
                else if (key === 'h') { setCurrentView('habits'); toast('Habits'); }
                else if (key === 'o') { setCurrentView('objectives'); toast('Objectives'); }
                else if (key === 'a') { setCurrentView('adventure'); toast('Adventure'); }
                return;
            }

            // Tab cycling WITHIN the current section ([ / ] — PageUp/PageDown alias).
            // One consistent meaning everywhere: Tasks filters, Mail folders, Habit views.
            if (key === '[' || key === ']' || key === 'pageup' || key === 'pagedown') {
                e.preventDefault();
                const back = key === '[' || key === 'pageup';
                if (uiState.currentView === 'tasks') {
                    const items = ['active', 'today', 'upcoming', 'review'] as const;
                    const idx = items.indexOf(uiState.filter as any);
                    const next = (idx + (back ? -1 : 1) + items.length) % items.length;
                    setFilter(items[next]);
                } else if (uiState.currentView === 'mail') {
                    const items = ['inbox', 'to_read', 'to_reply', 'other'] as const;
                    const idx = items.indexOf(mailState.activeTab);
                    const next = (idx + (back ? -1 : 1) + items.length) % items.length;
                    setActiveTab(items[next]);
                } else if (uiState.currentView === 'habits') {
                    uiState.cycleHabitView(back ? 'prev' : 'next');
                }
                return;
            }

            // ----------------------------------------------------------------
            // TASK VIEW HOTKEYS
            // ----------------------------------------------------------------
            if (uiState.currentView === 'tasks') {

                // Quick Add.
                // The list views (Inbox/Today/Upcoming) own Enter via
                // useTaskListKeyboard — it has the focused row + day-group context
                // and sets the inherited due date / importance. Handling Enter here
                // too would clobber that with a context-free open, so we only act in
                // views where that hook isn't mounted (Weekly Review).
                if (key === 'enter' && !isCmd && !isAlt && !isShift) {
                    if (uiState.filter !== 'review') return; // TaskList handles it
                    e.preventDefault();
                    setQuickAddOpen(true);
                    return;
                }
            }

            // ----------------------------------------------------------------
            // HABITS VIEW HOTKEYS
            // ----------------------------------------------------------------
            // Grid/Checklist internal navigation (arrows, space, e, del, week nav)
            // is owned by the Habits components themselves, which hold the focus
            // and week state. Section + tab navigation is handled globally above.

            // ----------------------------------------------------------------
            // MAIL VIEW HOTKEYS
            // ----------------------------------------------------------------
            if (uiState.currentView === 'mail') {

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
