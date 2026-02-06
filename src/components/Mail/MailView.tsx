import React from 'react';
import { motion } from 'framer-motion';
import { Archive } from 'lucide-react';
import { useMailStore, filterEmails } from '../../store/useMailStore';
import { useUIStore } from '../../store/useUIStore';

export function MailView() {
    const { emails, selectedId, setSelectedId, focusedIndex, setFocusedIndex, activeTab } = useMailStore();
    const currentView = useUIStore((state) => state.currentView);

    // Derived from store state using shared helper
    const filteredEmails = React.useMemo(() =>
        filterEmails(emails, activeTab),
        [emails, activeTab]);

    // Scroll focused item into view
    React.useEffect(() => {
        if (filteredEmails.length === 0) return;
        const el = document.getElementById(`email-${focusedIndex}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [focusedIndex, filteredEmails]);

    // Initial Fetch (Sync)
    // Initial Fetch (Cache) & Background Sync
    React.useEffect(() => {
        useMailStore.getState().fetchEmails();
        useMailStore.getState().syncEmails();
    }, []);

    return (
        <div className="h-full flex flex-col">
            {/* Email List */}
            <div className="flex-1 overflow-y-auto">
                {filteredEmails.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
                        <Archive className="w-12 h-12 mb-4 opacity-50" />
                        <p className="text-lg font-medium">All clear!</p>
                        <p className="text-sm">No emails in this view.</p>
                    </div>
                ) : (
                    <div>
                        {filteredEmails.map((email, index) => (
                            <motion.div
                                id={`email-${index}`}
                                key={email.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.02 }}
                                onClick={() => {
                                    setSelectedId(email.id);
                                    setFocusedIndex(index);
                                }}
                                data-selected={selectedId === email.id}
                                data-read={email.isRead}
                                className={`
                                    px-4 py-3 cursor-pointer transition-colors relative
                                    border-b border-slate-100 dark:border-slate-800 last:border-0
                                    
                                    data-[selected=true]:bg-primary-50 
                                    dark:data-[selected=true]:bg-primary-900/20 
                                    data-[selected=true]:border-l-2 
                                    data-[selected=true]:border-l-primary-500

                                    data-[selected=false]:hover:bg-slate-50 
                                    dark:data-[selected=false]:hover:bg-slate-800/50 
                                    data-[selected=false]:border-l-2 
                                    data-[selected=false]:border-l-transparent

                                    data-[read=false]:font-semibold
                                `}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm text-slate-900 dark:text-slate-100 truncate">
                                                {email.senderName}
                                            </span>
                                            <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto whitespace-nowrap">
                                                {new Date(email.internalDate).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{email.subject}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{email.snippet}</p>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
