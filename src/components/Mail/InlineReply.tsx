import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMailStore, Email } from '../../store/useMailStore';
import { supabase } from '../../utils/supabase';
import { marked } from 'marked';
import { Send, X } from 'lucide-react';
import { toast } from '../Toaster';

function parseRecipients(headerValue: string): string[] {
    if (!headerValue) return [];
    return headerValue
        .split(',')
        .map(r => {
            const match = r.match(/<(.+?)>/);
            return (match ? match[1] : r).trim();
        })
        .filter(Boolean);
}

function deriveRecipients(
    email: Email,
    mode: 'reply' | 'replyAll',
    currentUserEmail: string
): { to: string; cc: string } {
    if (mode === 'reply') {
        return { to: email.senderEmail, cc: '' };
    }

    const originalTo = parseRecipients(email.payload?.to ?? '');
    const originalCc = parseRecipients(email.payload?.cc ?? '');
    const lowerUser = currentUserEmail.toLowerCase();

    const allRecipients = [email.senderEmail, ...originalTo, ...originalCc];
    const deduplicated = [...new Set(allRecipients.map(e => e.toLowerCase()))];
    const filtered = deduplicated.filter(e => e !== lowerUser);

    const to = email.senderEmail;
    const cc = filtered.filter(e => e.toLowerCase() !== email.senderEmail.toLowerCase()).join(', ');

    return { to, cc };
}

interface InlineReplyProps {
    email: Email;
    mode: 'reply' | 'replyAll';
    onClose: () => void;
}

export const InlineReply = ({ email, mode, onClose }: InlineReplyProps) => {
    const sendEmail = useMailStore((state) => state.sendEmail);
    const [body, setBody] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [currentUserEmail, setCurrentUserEmail] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setCurrentUserEmail(data.user?.email ?? '');
        });
    }, []);

    useEffect(() => {
        textareaRef.current?.focus();
    }, [mode]);

    const { to, cc } = deriveRecipients(email, mode, currentUserEmail);

    const handleSend = useCallback(async () => {
        if (!body.trim()) {
            toast('Please write a reply');
            return;
        }

        setIsSending(true);
        try {
            const htmlBody = await marked.parse(body);
            const subject = email.subject.startsWith('Re:')
                ? email.subject
                : `Re: ${email.subject}`;

            await sendEmail({
                to,
                cc: cc || undefined,
                subject,
                body: htmlBody,
                threadId: email.threadId,
                replyToMessageId: email.payload?.messageId,
            });
            toast('Reply sent!');
            setBody('');
            onClose();
        } catch (error) {
            toast('Failed to send reply');
            console.error('InlineReply send failed:', error);
        } finally {
            setIsSending(false);
        }
    }, [body, email, to, cc, sendEmail, onClose]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSend();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onClose();
        }
    };

    const label = mode === 'replyAll' ? 'Reply All' : 'Reply';

    return (
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-4 shrink-0">
            <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-slate-500">
                    {label} to {to}{cc ? `, cc: ${cc}` : ''}
                </div>
                <button
                    onClick={onClose}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    title="Close (Esc)"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
            <textarea
                ref={textareaRef}
                value={body}
                onChange={e => setBody(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full min-h-[120px] resize-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-800 dark:text-slate-300 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                placeholder="Write your reply..."
            />
            <div className="flex items-center justify-end gap-3 mt-2">
                <span className="text-xs text-slate-400">Cmd + Enter to send</span>
                <button
                    onClick={handleSend}
                    disabled={isSending}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSending ? 'Sending...' : (
                        <>
                            Send
                            <Send className="w-3.5 h-3.5" />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
