import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Send, Loader2, ImagePlus, Trash2, Settings } from 'lucide-react';
import { useCoachStore } from '../store/useCoachStore';
import { useTaskStore } from '../store/useTaskStore';
import { chatWithCoach, isApiConfigured, ChatMessage } from '../utils/gemini';
import { Task } from '../types';

// Helper: Get ISO week string (same as WeeklyReview)
const getWeekKey = (date: Date): string => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
};

const formatWeekLabel = (weekKey: string): string => {
    const now = new Date();
    const thisWeek = getWeekKey(now);
    const lastWeekDate = new Date(now);
    lastWeekDate.setDate(now.getDate() - 7);
    const lastWeek = getWeekKey(lastWeekDate);

    if (weekKey === thisWeek) return 'This Week';
    if (weekKey === lastWeek) return 'Last Week';

    const [year, week] = weekKey.split('-W');
    return `Week ${parseInt(week)}, ${year}`;
};

export const CoachChat: React.FC = () => {
    const {
        isOpen,
        selectedWeek,
        context,
        conversations,
        isLoading,
        error,
        setOpen,
        setContext,
        addMessage,
        clearConversation,
        setLoading,
        setError,
    } = useCoachStore();

    const tasks = useTaskStore((state) => state.tasks);
    const [input, setInput] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [calendarImage, setCalendarImage] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Get current week if none selected
    const weekKey = selectedWeek || getWeekKey(new Date());
    const weekLabel = formatWeekLabel(weekKey);
    const messages = conversations[weekKey] || [];

    // Get completed tasks for this week
    const getCompletedTasksForWeek = useCallback((): Task[] => {
        return tasks.filter(t => {
            if (!t.completed || !t.completedAt || t.archived) return false;
            const taskWeek = getWeekKey(new Date(t.completedAt));
            return taskWeek === weekKey;
        });
    }, [tasks, weekKey]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && !showSettings) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, showSettings]);

    // Handle paste for calendar images
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        setCalendarImage(event.target?.result as string);
                    };
                    reader.readAsDataURL(file);
                }
                break;
            }
        }
    }, []);

    // Send message
    const sendMessage = async () => {
        if (!input.trim() && !calendarImage) return;
        if (isLoading) return;

        const userMessage: ChatMessage = {
            role: 'user',
            content: input.trim() || 'Please analyze my calendar.',
            timestamp: new Date(),
        };

        addMessage(weekKey, userMessage);
        setInput('');
        setLoading(true);
        setError(null);

        try {
            const completedTasks = getCompletedTasksForWeek();
            const allMessages = [...messages, userMessage];

            const response = await chatWithCoach(
                allMessages,
                context,
                completedTasks,
                weekLabel,
                calendarImage || undefined
            );

            const coachMessage: ChatMessage = {
                role: 'coach',
                content: response,
                timestamp: new Date(),
            };

            addMessage(weekKey, coachMessage);
            setCalendarImage(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Keyboard handling
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
        if (e.key === 'Escape') {
            if (showSettings) {
                setShowSettings(false);
            } else {
                setOpen(false);
            }
        }
    };

    if (!isOpen) return null;

    // Settings panel
    if (showSettings) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Coach Context</h3>
                        <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>

                    <div className="p-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Your Profile
                            </label>
                            <textarea
                                value={context.profile}
                                onChange={(e) => setContext({ profile: e.target.value })}
                                placeholder="Your role, responsibilities, team structure..."
                                className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Goals & Priorities
                            </label>
                            <textarea
                                value={context.goals}
                                onChange={(e) => setContext({ goals: e.target.value })}
                                placeholder="Your quarterly goals, key priorities, what you're working towards..."
                                className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                            />
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            This context helps the coach provide more relevant and personalized feedback.
                        </p>
                    </div>

                    <div className="flex justify-end px-4 py-3 border-t border-slate-200 dark:border-slate-800">
                        <button
                            onClick={() => setShowSettings(false)}
                            className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-500 transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // API not configured
    if (!isApiConfigured()) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 text-center">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">API Key Required</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        Add your Gemini API key to <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">.env.local</code>:
                    </p>
                    <code className="block text-xs bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-left mb-4">
                        VITE_GEMINI_API_KEY=your_api_key_here
                    </code>
                    <button
                        onClick={() => setOpen(false)}
                        className="px-4 py-2 text-sm font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    // Main chat UI
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl h-[80vh] bg-white dark:bg-slate-900 rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <div>
                        <h3 className="font-semibold text-slate-800 dark:text-slate-200">Weekly Review</h3>
                        <span className="text-xs text-slate-500">{weekLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowSettings(true)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            title="Coach Settings"
                        >
                            <Settings className="w-4 h-4" />
                        </button>
                        {messages.length > 0 && (
                            <button
                                onClick={() => clearConversation(weekKey)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-red-500"
                                title="Clear Conversation"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={() => setOpen(false)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 && (
                        <div className="text-center py-8">
                            <p className="text-slate-500 dark:text-slate-400 mb-2">
                                Start a conversation about your week
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                                You can paste a calendar screenshot for context
                            </p>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] px-4 py-2 rounded-lg text-sm ${msg.role === 'user'
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                                    }`}
                            >
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-lg">
                                <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Calendar image preview */}
                {calendarImage && (
                    <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50">
                        <img src={calendarImage} alt="Calendar" className="h-12 rounded shadow" />
                        <span className="text-xs text-slate-500 flex-1">Calendar attached</span>
                        <button
                            onClick={() => setCalendarImage(null)}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                        >
                            <X className="w-4 h-4 text-slate-500" />
                        </button>
                    </div>
                )}

                {/* Input */}
                <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
                    <div className="flex items-end gap-2">
                        <button
                            onClick={() => {
                                inputRef.current?.focus();
                                // Trigger file picker or inform user about paste
                                alert('Paste a calendar screenshot (Ctrl/Cmd + V) to attach');
                            }}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 shrink-0"
                            title="Attach Calendar"
                        >
                            <ImagePlus className="w-5 h-5" />
                        </button>
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            placeholder="Ask about your week... (paste calendar image with Ctrl+V)"
                            rows={1}
                            className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                            style={{ minHeight: '40px', maxHeight: '120px' }}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={isLoading || (!input.trim() && !calendarImage)}
                            className="p-2 bg-primary-600 hover:bg-primary-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg shrink-0 transition-colors"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                        Enter to send • Shift+Enter for new line • Escape to close
                    </p>
                </div>
            </div>
        </div>
    );
};
