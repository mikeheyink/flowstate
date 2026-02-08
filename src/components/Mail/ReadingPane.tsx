import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useMailStore } from '../../store/useMailStore';
import { useUIStore } from '../../store/useUIStore';
import { Archive } from 'lucide-react';
import { ThreadMessage } from './ThreadMessage';
import { InlineReply } from './InlineReply';

export const ReadingPane = () => {
    const emails = useMailStore((state) => state.emails);
    const selectedId = useMailStore((state) => state.selectedId);
    const archiveEmail = useMailStore((state) => state.archiveEmail);
    const markAsRead = useMailStore((state) => state.markAsRead);
    const setReadingPaneOpen = useMailStore((state) => state.setReadingPaneOpen);
    const replyMode = useUIStore((state) => state.replyMode);
    const setReplyMode = useUIStore((state) => state.setReplyMode);

    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const selectedEmail = emails.find(e => e.id === selectedId);

    const threadEmails = useMemo(() => {
        if (!selectedEmail) return [];
        return emails
            .filter(e => e.threadId === selectedEmail.threadId)
            .sort((a, b) => a.internalDate - b.internalDate);
    }, [emails, selectedEmail]);

    const latestEmail = threadEmails[threadEmails.length - 1];

    useEffect(() => {
        if (selectedId) {
            markAsRead(selectedId);
        }
    }, [selectedId, markAsRead]);

    useEffect(() => {
        setExpandedIds(new Set());
    }, [selectedEmail?.threadId]);

    const toggleMessage = useCallback((id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    if (!selectedId || !selectedEmail) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-slate-950 text-slate-400">
                <div className="p-4 rounded-full bg-slate-50 dark:bg-slate-900 mb-4">
                    <svg className="w-12 h-12 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                </div>
                <p>Select an email to read</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-950 overflow-hidden relative">
            {/* Thread Header */}
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-start justify-between mb-2 gap-4">
                    <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight flex-1">
                        {selectedEmail.subject}
                    </h1>
                    <div className="flex items-center gap-1">
                        {threadEmails.length > 1 && (
                            <span className="text-xs text-slate-400 mr-2">{threadEmails.length} messages</span>
                        )}
                        <button
                            onClick={() => archiveEmail(selectedEmail.id)}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                            title="Archive (e)"
                        >
                            <Archive className="w-5 h-5" />
                        </button>
                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-800 mx-1" />
                        <button
                            onClick={() => setReadingPaneOpen(false)}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                            title="Close (Esc)"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Thread Messages */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {threadEmails.map((email) => (
                    <ThreadMessage
                        key={email.id}
                        email={email}
                        isLatest={email.id === latestEmail?.id}
                        isExpanded={expandedIds.has(email.id)}
                        onToggle={() => toggleMessage(email.id)}
                    />
                ))}
            </div>

            {replyMode !== 'none' && latestEmail && (
                <InlineReply
                    email={latestEmail}
                    mode={replyMode}
                    onClose={() => setReplyMode('none')}
                />
            )}
        </div>
    );
};
