import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '../store/useUIStore';
import { useTaskStore } from '../store/useTaskStore';
import { useMailStore, filterEmails } from '../store/useMailStore';
import { groupByThread } from '../utils/threadUtils';
import { toast } from '../components/Toaster';

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
            // 1. Global Ignore Rules — don't intercept keys when a form element or button is focused
            if (
                document.activeElement?.tagName === 'INPUT' ||
                document.activeElement?.tagName === 'TEXTAREA' ||
                document.activeElement?.tagName === 'BUTTON'
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

            // 2. Modal override — compose modal manages its own keyboard events
            if (uiState.isComposeOpen) return;

            // 3. Inline reply override — reply textarea manages its own keyboard events
            if (uiState.replyMode !== 'none') return;

            // ----------------------------------------------------------------
            // GLOBAL HOTKEYS (Application-wide)
            // ----------------------------------------------------------------

            // Shortcuts Modal (?)
            if (key === '?' && !isCmd) {
                setShortcutsOpen(true);
                return;
            }
            if (key === 'escape') {
                if (uiState.isShortcutsOpen) { setShortcutsOpen(false); return; }
                if (uiState.isCmdOpen) { setCmdOpen(false); return; }
                if (uiState.isQuickAddOpen) { setQuickAddOpen(false); return; }

                // Mail Reading Pane Escape
                if (uiState.currentView === 'mail' && mailState.isReadingPaneOpen) {
                    mailState.setReadingPaneOpen(false);
                    return;
                }
                return;
            }

            // Command Palette (Cmd+K)
            if (isCmd && key === 'k') {
                e.preventDefault();
                toggleCmd();
                return;
            }

            // View Switching (Cmd+Arrow)
            if (isCmd && (key === 'arrowright' || key === 'arrowleft')) {
                e.preventDefault();
                const views = ['tasks', 'mail'] as const;
                const currentIdx = views.indexOf(uiState.currentView);
                if (key === 'arrowright' && currentIdx < views.length - 1) {
                    setCurrentView(views[currentIdx + 1]);
                    toast(`Switched to ${views[currentIdx + 1] === 'mail' ? 'Mail' : 'Tasks'}`);
                } else if (key === 'arrowleft' && currentIdx > 0) {
                    setCurrentView(views[currentIdx - 1]);
                    toast(`Switched to ${views[currentIdx - 1] === 'mail' ? 'Mail' : 'Tasks'}`);
                }
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

            // ----------------------------------------------------------------
            // G-CHORD NAVIGATION (Global)
            // ----------------------------------------------------------------
            if (key === 'g' && !isCmd && !gPressed) {
                setGPressed(true);
                if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current);
                gTimeoutRef.current = window.setTimeout(() => setGPressed(false), 500);
                return;
            }

            if (gPressed) {
                // Cross-view navigation
                if (key === 'm') { setCurrentView('mail'); setActiveTab('inbox'); toast('Go to Mail'); }
                if (key === 't' && uiState.currentView !== 'tasks') { setCurrentView('tasks'); toast('Go to Tasks'); }

                // Task filters (only when in tasks view, or switch to tasks)
                if (key === 'i') {
                    if (uiState.currentView !== 'tasks') setCurrentView('tasks');
                    setFilter('active'); toast('Go to Inbox');
                }
                if (key === 't' && uiState.currentView === 'tasks') { setFilter('today'); toast('Go to Today'); }
                if (key === 'r') { setFilter('review'); toast('Go to Review'); }

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
                if (key === 'pagedown') {
                    e.preventDefault();
                    const currentFilter = uiState.filter;
                    const items = ['active', 'today', 'upcoming', 'review'] as const;
                    const idx = items.indexOf(currentFilter as any);
                    const nextIndex = (idx + 1) % items.length;
                    setFilter(items[nextIndex]);
                    return;
                }
                if (key === 'pageup') {
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
            // MAIL VIEW HOTKEYS
            // ----------------------------------------------------------------
            if (uiState.currentView === 'mail') {

                // Sidebar Cycle (PageUp/Down) - MAIL
                if (key === 'pagedown') {
                    e.preventDefault();
                    const currentTab = mailState.activeTab;
                    const items = ['inbox', 'to_read', 'to_reply', 'other'] as const;
                    const idx = items.indexOf(currentTab);
                    const nextIndex = (idx + 1) % items.length;
                    setActiveTab(items[nextIndex]);
                    return;
                }
                if (key === 'pageup') {
                    e.preventDefault();
                    const currentTab = mailState.activeTab;
                    const items = ['inbox', 'to_read', 'to_reply', 'other'] as const;
                    const idx = items.indexOf(currentTab);
                    const nextIndex = (idx - 1 + items.length) % items.length;
                    setActiveTab(items[nextIndex]);
                    return;
                }

                // Navigation (Arrows) - Thread-aware
                if (key === 'arrowdown') {
                    e.preventDefault();
                    const threads = groupByThread(filterEmails(mailState.emails, mailState.activeTab));
                    if (threads.length === 0) return;

                    const nextIndex = Math.min(mailState.focusedIndex + 1, threads.length - 1);
                    if (threads[nextIndex]) {
                        mailState.navigateEmail(nextIndex, threads[nextIndex].latestEmail.id);
                    }
                    return;
                }

                // Open Reading Pane (Enter)
                if (key === 'enter' && !isCmd && !isAlt && !isShift) {
                    e.preventDefault();
                    if (mailState.selectedId) {
                        mailState.setReadingPaneOpen(true);
                    }
                    return;
                }
                if (key === 'arrowup') {
                    e.preventDefault();
                    const threads = groupByThread(filterEmails(mailState.emails, mailState.activeTab));
                    if (threads.length === 0) return;

                    const prevIndex = Math.max(mailState.focusedIndex - 1, 0);
                    if (threads[prevIndex]) {
                        mailState.navigateEmail(prevIndex, threads[prevIndex].latestEmail.id);
                    }
                    return;
                }

                // Actions
                if (key === 'e' || key === 'x') {
                    e.preventDefault();
                    if (mailState.selectedId) {
                        const threads = groupByThread(filterEmails(mailState.emails, mailState.activeTab));
                        const currentIdx = mailState.focusedIndex;
                        const currentThread = threads.find(t => t.emails.some(em => em.id === mailState.selectedId));

                        mailState.archiveEmail(mailState.selectedId);

                        // Auto-advance: pick next thread, or previous if at end
                        const remaining = threads.filter(t => t.threadId !== currentThread?.threadId);
                        if (remaining.length > 0) {
                            const nextIdx = Math.min(currentIdx, remaining.length - 1);
                            mailState.navigateEmail(nextIdx, remaining[nextIdx].latestEmail.id);
                        }
                        toast('Archived');
                    }
                }

                if (key === 'c') {
                    e.preventDefault();
                    useUIStore.getState().setComposeOpen(true);
                }

                // Reply (r)
                if (key === 'r' && !isShift && !isCmd) {
                    e.preventDefault();
                    if (mailState.selectedId) {
                        if (!mailState.isReadingPaneOpen) {
                            mailState.setReadingPaneOpen(true);
                        }
                        useUIStore.getState().setReplyMode('reply');
                    }
                    return;
                }

                // Reply All (a)
                if (key === 'a' && !isShift && !isCmd) {
                    e.preventDefault();
                    if (mailState.selectedId) {
                        if (!mailState.isReadingPaneOpen) {
                            mailState.setReadingPaneOpen(true);
                        }
                        useUIStore.getState().setReplyMode('replyAll');
                    }
                    return;
                }

                // Forward (f)
                if (key === 'f' && !isShift && !isCmd) {
                    e.preventDefault();
                    if (mailState.selectedId) {
                        const email = mailState.emails.find(em => em.id === mailState.selectedId);
                        if (email) {
                            useUIStore.getState().setForwardContext({
                                to: '',
                                subject: email.subject,
                                body: email.payload?.body ?? email.snippet,
                                threadId: email.threadId,
                            });
                            useUIStore.getState().setComposeOpen(true);
                        }
                    }
                    return;
                }

                if (key === 'r' && isShift) {
                    e.preventDefault();
                    if (mailState.selectedId) {
                        mailState.addLabel(mailState.selectedId, 'FLOWSTATE/ToRead');
                        toast('Marked for Later Reading');
                    }
                }

                if (key === 'y' && isShift) {
                    e.preventDefault();
                    if (mailState.selectedId) {
                        mailState.addLabel(mailState.selectedId, 'FLOWSTATE/ToReply');
                        toast('Marked to Reply');
                    }
                }

                // Trash (#)
                if (key === '#' || (isShift && key === '3')) {
                    e.preventDefault();
                    if (mailState.selectedId) {
                        const threads = groupByThread(filterEmails(mailState.emails, mailState.activeTab));
                        const currentIdx = mailState.focusedIndex;
                        const currentThread = threads.find(t => t.emails.some(em => em.id === mailState.selectedId));

                        mailState.trashEmail(mailState.selectedId);

                        // Auto-advance
                        const remaining = threads.filter(t => t.threadId !== currentThread?.threadId);
                        if (remaining.length > 0) {
                            const nextIdx = Math.min(currentIdx, remaining.length - 1);
                            mailState.navigateEmail(nextIdx, remaining[nextIdx].latestEmail.id);
                        }
                        toast('Trashed');
                    }
                }

                // Mark unread (u) — closes reading pane to prevent auto-mark-read conflict
                if (key === 'u' && !isCmd && !isShift) {
                    e.preventDefault();
                    if (mailState.selectedId) {
                        if (mailState.isReadingPaneOpen) {
                            mailState.setReadingPaneOpen(false);
                        }
                        mailState.markAsUnread(mailState.selectedId);
                        toast('Marked as unread');
                    }
                }

                // Mark read (Shift+I)
                if (key === 'i' && isShift && !isCmd) {
                    e.preventDefault();
                    if (mailState.selectedId) {
                        mailState.markAsRead(mailState.selectedId);
                        toast('Marked as read');
                    }
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
