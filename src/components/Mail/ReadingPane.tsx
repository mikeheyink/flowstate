import React, { useEffect } from 'react';
import { useMailStore } from '../../store/useMailStore';
import { Archive } from 'lucide-react';
import DOMPurify from 'isomorphic-dompurify';
import { format } from 'date-fns';

export const ReadingPane = () => {
    const { emails, selectedId, archiveEmail, markAsRead, setReadingPaneOpen } = useMailStore();

    const email = emails.find(e => e.id === selectedId);

    // Auto-mark as read when viewing an email in the reading pane
    useEffect(() => {
        if (selectedId && email && !email.isRead) {
            markAsRead(selectedId);
        }
    }, [selectedId, email?.isRead, markAsRead]);

    if (!selectedId || !email) {
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

    const cleanHtml = DOMPurify.sanitize(email.payload?.body || '', {
        USE_PROFILES: { html: true },
        ADD_TAGS: ['style'], // Allow styles for email rendering
        ADD_ATTR: ['target'] // Allow links to open in new tab
    });

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-950 overflow-hidden relative">
            {/* Header / Meta */}
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-start justify-between mb-4 gap-4">
                    <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight flex-1">
                        {email.subject}
                    </h1>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => archiveEmail(email.id)}
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

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
                            {(email.senderName || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="flex items-baseline gap-2">
                                <span className="font-semibold text-slate-900 dark:text-slate-200 text-sm">{email.senderName}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-500 text-sm hidden sm:inline">&lt;{email.senderEmail}&gt;</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                                to me
                            </div>
                        </div>
                    </div>

                    <div className="text-xs text-slate-400">
                        {format(email.internalDate, 'MMM d, yyyy, h:mm a')}
                    </div>
                </div>
            </div>

            {/* Email Body */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                <div
                    className="email-content prose prose-slate dark:prose-invert max-w-none prose-sm sm:prose-base focus:outline-none"
                    // Important: Email HTML often needs specific overrides to look good in dark mode
                    // We might need a Shadow DOM wrapper eventually.
                    dangerouslySetInnerHTML={{ __html: cleanHtml }}
                />
            </div>

        </div>
    );
};
