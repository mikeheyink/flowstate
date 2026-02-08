import React, { useRef, useEffect, useMemo } from 'react';
import { useMailStore, filterEmails } from '../../store/useMailStore';
import { groupByThread } from '../../utils/threadUtils';
import { formatDistanceToNow } from 'date-fns';

export const ThreadList = () => {
    const emails = useMailStore((state) => state.emails);
    const activeTab = useMailStore((state) => state.activeTab);
    const selectedId = useMailStore((state) => state.selectedId);
    const navigateEmail = useMailStore((state) => state.navigateEmail);
    const isReadingPaneOpen = useMailStore((state) => state.isReadingPaneOpen);

    const filteredEmails = useMemo(() => filterEmails(emails, activeTab), [emails, activeTab]);
    const threads = useMemo(() => groupByThread(filteredEmails), [filteredEmails]);

    const scrollRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    useEffect(() => {
        if (selectedId) {
            const thread = threads.find(t => t.emails.some(e => e.id === selectedId));
            if (thread && itemRefs.current.has(thread.threadId)) {
                itemRefs.current.get(thread.threadId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [selectedId, threads]);

    if (threads.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center bg-slate-50 dark:bg-slate-900/50">
                <p>No emails here</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 w-full h-full bg-white dark:bg-slate-950 overflow-y-auto custom-scrollbar" ref={scrollRef}>
            {threads.map((thread, index) => {
                const isSelected = thread.emails.some(e => e.id === selectedId);
                const hasUnread = thread.unreadCount > 0;
                const { latestEmail } = thread;

                return (
                    <div
                        key={thread.threadId}
                        ref={(el) => {
                            if (el) itemRefs.current.set(thread.threadId, el);
                            else itemRefs.current.delete(thread.threadId);
                        }}
                        onClick={() => navigateEmail(index, latestEmail.id)}
                        className={`
                            group flex items-center gap-6 p-4 border-b border-slate-100 dark:border-slate-800/50 cursor-pointer transition-colors relative
                            ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'}
                        `}
                    >
                        {isSelected && (
                            <div className="absolute left-0 top-1 bottom-1 w-1 bg-indigo-500 rounded-r shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                        )}

                        <div className={`shrink-0 truncate ${isReadingPaneOpen ? 'w-[120px]' : 'w-[200px]'} ${hasUnread ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-400'} text-sm`}>
                            {latestEmail.senderName || latestEmail.senderEmail.split('@')[0]}
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                                <span className={`text-sm truncate ${hasUnread ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                                    {thread.subject}
                                </span>
                                {thread.messageCount > 1 && (
                                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full shrink-0">
                                        {thread.messageCount}
                                    </span>
                                )}
                                {hasUnread && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                )}
                            </div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 truncate line-clamp-1">
                                {latestEmail.snippet}
                            </div>
                        </div>

                        <div className="shrink-0 text-[11px] font-medium text-slate-400 dark:text-slate-500 tabular-nums">
                            {formatDistanceToNow(thread.latestDate, { addSuffix: false }).replace('about ', '')}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
