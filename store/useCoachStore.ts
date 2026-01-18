import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatMessage, CoachContext } from '../utils/gemini';

interface CoachState {
    // Context that persists
    context: CoachContext;

    // Conversation history by week
    conversations: Record<string, ChatMessage[]>;

    // UI state
    isOpen: boolean;
    selectedWeek: string | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    setContext: (context: Partial<CoachContext>) => void;
    setOpen: (open: boolean, weekKey?: string) => void;
    addMessage: (weekKey: string, message: ChatMessage) => void;
    clearConversation: (weekKey: string) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
}

export const useCoachStore = create<CoachState>()(
    persist(
        (set, get) => ({
            context: {
                profile: '',
                goals: '',
            },
            conversations: {},
            isOpen: false,
            selectedWeek: null,
            isLoading: false,
            error: null,

            setContext: (updates) => set((state) => ({
                context: { ...state.context, ...updates }
            })),

            setOpen: (open, weekKey) => set({
                isOpen: open,
                selectedWeek: weekKey || null,
                error: null,
            }),

            addMessage: (weekKey, message) => set((state) => {
                const existing = state.conversations[weekKey] || [];
                return {
                    conversations: {
                        ...state.conversations,
                        [weekKey]: [...existing, message]
                    }
                };
            }),

            clearConversation: (weekKey) => set((state) => {
                const { [weekKey]: _, ...rest } = state.conversations;
                return { conversations: rest };
            }),

            setLoading: (loading) => set({ isLoading: loading }),
            setError: (error) => set({ error }),
        }),
        {
            name: 'flowstate-coach',
            partialize: (state) => ({
                context: state.context,
                conversations: state.conversations,
            }),
        }
    )
);
