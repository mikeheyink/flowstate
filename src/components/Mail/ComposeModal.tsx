import React, { useState, useEffect } from 'react';
import { useMailStore } from '../../store/useMailStore';
import { X, Send, Minimize2 } from 'lucide-react';
import { toast } from '../Toaster';

export const ComposeModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const { sendEmail } = useMailStore();
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [isSending, setIsSending] = useState(false);

    // Focus To field on open
    const toInputRef = React.useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => toInputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    const handleSend = async () => {
        if (!to || !body) {
            toast('Please fill in To and Body');
            return;
        }

        setIsSending(true);
        try {
            await sendEmail({ to, subject, body });
            toast('Email sent!');
            onClose();
            // Reset form
            setTo('');
            setSubject('');
            setBody('');
        } catch (error) {
            toast('Failed to send email');
            console.error(error);
        } finally {
            setIsSending(false);
        }
    };

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onKeyDown={handleKeyDown}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="font-semibold text-slate-700 dark:text-slate-200">New Message</h3>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                            <Minimize2 className="w-4 h-4" />
                        </button>
                        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex flex-col flex-1 p-4 gap-4">
                    <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-sm font-medium text-slate-500 w-12 shrink-0">To:</span>
                        <input
                            ref={toInputRef}
                            value={to}
                            onChange={e => setTo(e.target.value)}
                            className="flex-1 bg-transparent outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                            placeholder="recipient@example.com"
                        />
                    </div>
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
