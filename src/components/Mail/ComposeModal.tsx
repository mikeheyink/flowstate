import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMailStore } from '../../store/useMailStore';
import { useUIStore } from '../../store/useUIStore';
import { marked } from 'marked';
import { X, Send } from 'lucide-react';
import { toast } from '../Toaster';
import { ContactAutocomplete, deriveContacts } from './ContactAutocomplete';

const FOCUSABLE_SELECTOR = 'input, textarea, button:not([disabled])';

export const ComposeModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const sendEmail = useMailStore((state) => state.sendEmail);
    const emails = useMailStore((state) => state.emails);
    const contacts = useMemo(() => deriveContacts(emails), [emails]);
    const forwardContext = useUIStore((state) => state.forwardContext);

    const [to, setTo] = useState('');
    const [cc, setCc] = useState('');
    const [bcc, setBcc] = useState('');
    const [showCcBcc, setShowCcBcc] = useState(false);
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [threadId, setThreadId] = useState<string | undefined>(undefined);
    const [isSending, setIsSending] = useState(false);

    const modalRef = useRef<HTMLDivElement>(null);
    const toInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && forwardContext) {
            setTo('');
            setSubject(forwardContext.subject.startsWith('Fwd:')
                ? forwardContext.subject
                : `Fwd: ${forwardContext.subject}`);
            setBody(`\n\n---------- Forwarded Message ----------\n${forwardContext.body}`);
            setThreadId(forwardContext.threadId);
            setTimeout(() => toInputRef.current?.focus(), 50);
        } else if (isOpen) {
            setTimeout(() => toInputRef.current?.focus(), 50);
        }
    }, [isOpen, forwardContext]);

    const handleSend = useCallback(async () => {
        if (!to || !body) {
            toast('Please fill in To and Body');
            return;
        }

        setIsSending(true);
        try {
            const htmlBody = await marked.parse(body);
            await sendEmail({ to, cc: cc || undefined, bcc: bcc || undefined, subject, body: htmlBody, threadId });
            toast('Email sent!');
            onClose();
            setTo('');
            setCc('');
            setBcc('');
            setShowCcBcc(false);
            setSubject('');
            setBody('');
            setThreadId(undefined);
        } catch (error) {
            toast('Failed to send email');
            console.error(error);
        } finally {
            setIsSending(false);
        }
    }, [to, cc, bcc, subject, body, threadId, sendEmail, onClose]);

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
        if (e.key === 'Tab' && modalRef.current) {
            const focusable = Array.from(
                modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
            );
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onKeyDown={handleKeyDown}>
            <div ref={modalRef} className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="font-semibold text-slate-700 dark:text-slate-200">{forwardContext ? 'Forward Message' : 'New Message'}</h3>
                    <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Fields */}
                <div className="flex flex-col flex-1 p-4 gap-4">
                    <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-sm font-medium text-slate-500 w-12 shrink-0">To:</span>
                        <ContactAutocomplete
                            inputRef={toInputRef}
                            value={to}
                            onChange={setTo}
                            contacts={contacts}
                            placeholder="recipient@example.com"
                        />
                        {!showCcBcc && (
                            <button
                                onClick={() => setShowCcBcc(true)}
                                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
                            >
                                Cc/Bcc
                            </button>
                        )}
                    </div>
                    {showCcBcc && (
                        <>
                            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                                <span className="text-sm font-medium text-slate-500 w-12 shrink-0">Cc:</span>
                                <ContactAutocomplete
                                    value={cc}
                                    onChange={setCc}
                                    contacts={contacts}
                                    placeholder="cc@example.com"
                                />
                            </div>
                            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                                <span className="text-sm font-medium text-slate-500 w-12 shrink-0">Bcc:</span>
                                <ContactAutocomplete
                                    value={bcc}
                                    onChange={setBcc}
                                    contacts={contacts}
                                    placeholder="bcc@example.com"
                                />
                            </div>
                        </>
                    )}
                    <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-sm font-medium text-slate-500 w-12 shrink-0">Subject:</span>
                        <input
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            className="flex-1 bg-transparent outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 font-medium"
                            placeholder="Subject"
                        />
                    </div>
                    <textarea
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        className="flex-1 min-h-[300px] resize-none bg-transparent outline-none text-slate-800 dark:text-slate-300 placeholder:text-slate-400 font-sans leading-relaxed p-2"
                        placeholder="Write something..."
                    />
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 hidden sm:inline">Cmd + Enter to send</span>
                        <button
                            onClick={handleSend}
                            disabled={isSending}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSending ? 'Sending...' : (
                                <>
                                    Send
                                    <Send className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
