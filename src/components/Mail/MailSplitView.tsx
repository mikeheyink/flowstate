import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThreadList } from './ThreadList';
import { ReadingPane } from './ReadingPane';
import { useMailStore } from '../../store/useMailStore';

export const MailSplitView = () => {
    const fetchEmails = useMailStore((state) => state.fetchEmails);
    const syncEmails = useMailStore((state) => state.syncEmails);
    const emails = useMailStore((state) => state.emails);
    const isReadingPaneOpen = useMailStore((state) => state.isReadingPaneOpen);

    useEffect(() => {
        // Initial load
        if (emails.length === 0) {
            fetchEmails();
            syncEmails(); // Background sync
        }
    }, [emails.length, fetchEmails, syncEmails]);

    return (
        <div className="relative flex w-full h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
            {/* Middle Pane: Thread List */}
            <motion.div
                animate={{
                    width: isReadingPaneOpen ? '450px' : '100%',
                    flexShrink: 0
                }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="h-full flex flex-col border-r border-slate-200 dark:border-slate-800 z-10 bg-white dark:bg-slate-950 shadow-[4px_0_24px_rgba(0,0,0,0.02)]"
            >
                <div className="p-4 px-6 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-700 dark:text-slate-200">Inbox</h2>
                    <span className="text-xs text-slate-400 font-medium">{emails.length} items</span>
                </div>
                <ThreadList />
            </motion.div>

            {/* Right Pane: Reading Pane (Conditional Slide-in) */}
            <AnimatePresence mode="popLayout">
                {isReadingPaneOpen && (
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="flex-1 h-full min-w-0 bg-white dark:bg-slate-950 z-0 relative"
                    >
                        <ReadingPane />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
