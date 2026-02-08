import React from 'react';
import { Email } from '../../store/useMailStore';
import { ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { EmailContent } from './EmailContent';

interface ThreadMessageProps {
    email: Email;
    isExpanded: boolean;
    onToggle: () => void;
    isLatest: boolean;
}

export const ThreadMessage = ({ email, isExpanded, onToggle, isLatest }: ThreadMessageProps) => {
    const showBody = isLatest || isExpanded;

    const rawHtml = showBody ? (email.payload?.body || '') : '';

    if (!showBody) {
        return (
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-3 px-8 py-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors text-left"
            >
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-semibold text-xs shrink-0">
                    {(email.senderName || '?').charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 shrink-0">
                    {email.senderName}
                </span>
                <span className="text-xs text-slate-400 truncate flex-1">
                    {email.snippet}
                </span>
                <span className="text-xs text-slate-400 shrink-0">
                    {format(email.internalDate, 'MMM d')}
                </span>
            </button>
        );
    }

    return (
        <div className={`border-b border-slate-100 dark:border-slate-800 ${!isLatest ? 'bg-slate-50/50 dark:bg-slate-900/30' : ''}`}>
            <div className="px-8 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {!isLatest && (
                            <button onClick={onToggle} className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                <ChevronRight className="w-4 h-4 rotate-90" />
                            </button>
                        )}
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-semibold text-xs">
                            {(email.senderName || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="flex items-baseline gap-2">
                                <span className="font-semibold text-slate-900 dark:text-slate-200 text-sm">{email.senderName}</span>
                                <span className="text-xs text-slate-500 hidden sm:inline">&lt;{email.senderEmail}&gt;</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-xs text-slate-400">
                        {format(email.internalDate, 'MMM d, yyyy, h:mm a')}
                    </div>
                </div>
            </div>
            <div className="px-8 pb-6">
                <EmailContent html={rawHtml} />
            </div>
        </div>
    );
};
