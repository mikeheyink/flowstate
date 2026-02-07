import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { GmailService } from '../services/gmail';
import { supabase } from '../utils/supabase';
import { toast } from '../components/Toaster';

// Email interface
export interface Email {
    id: string;
    gmailId: string;
    threadId: string;
    historyId?: string;
    internalDate: number;
    subject: string;
    snippet: string;
    senderName: string;
    senderEmail: string;
    payload?: any;
    status: 'inbox' | 'to_read' | 'to_reply' | 'done' | 'trash';
    isRead: boolean;
    labels?: string[];
    createdAt: string;
    updatedAt: string;
}

export type MailTab = 'inbox' | 'to_read' | 'to_reply' | 'other';




// Store state
interface MailState {
    emails: Email[];
    selectedId: string | null;
    focusedIndex: number;
    activeTab: MailTab;
    tabHistory: Record<string, string>;
    isLoading: boolean;
    error: string | null;
    isReadingPaneOpen: boolean; // New

    // Actions
    setEmails: (emails: Email[]) => void;
    setSelectedId: (id: string | null) => void;
    setReadingPaneOpen: (isOpen: boolean) => void; // New
    setFocusedIndex: (index: number) => void;
    setActiveTab: (tab: MailTab) => void;
    archiveEmail: (id: string) => void;
    setEmailStatus: (id: string, status: Email['status']) => void;
    markAsRead: (id: string) => void;
    addLabel: (id: string, label: string) => void; // New
    navigateEmail: (index: number, id: string) => void;
    fetchEmails: () => Promise<void>;
    syncEmails: () => Promise<void>;
    sendEmail: (payload: { to: string; subject: string; body: string; threadId?: string; replyToMessageId?: string }) => Promise<void>; // New
}

export const filterEmails = (emails: Email[], tab: MailTab) => {
    switch (tab) {
        case 'inbox':
            // Inbox = Status 'inbox' AND (Has CATEGORY_PERSONAL OR No Category Label)
            return emails.filter((e) => e.status === 'inbox' && (e.labels?.includes('CATEGORY_PERSONAL') || !e.labels?.some(l => l.startsWith('CATEGORY_'))));

        case 'to_read':
            // Filter by Label: FLOWSTATE/ToRead
            return emails.filter((e) => e.labels?.includes('FLOWSTATE/ToRead'));

        case 'to_reply':
            // Filter by Label: FLOWSTATE/ToReply
            return emails.filter((e) => e.labels?.includes('FLOWSTATE/ToReply'));

        case 'other':
            // Other = Status 'inbox' AND NOT Primary
            return emails.filter((e) => e.status === 'inbox' && !e.labels?.includes('CATEGORY_PERSONAL') && e.labels?.some(l => l.startsWith('CATEGORY_')));

        default: return emails;
    }
};

export const useMailStore = create<MailState>()(
    devtools(
        (set, get) => ({
            emails: [],
            selectedId: null,
            focusedIndex: 0,
            activeTab: 'inbox',
            tabHistory: {},
            isLoading: false,
            error: null,
            isReadingPaneOpen: false,

            setEmails: (emails) => set({ emails }),

            setSelectedId: (id) => set((state) => ({
                selectedId: id,
                tabHistory: id ? { ...state.tabHistory, [state.activeTab]: id } : state.tabHistory
            })),

            setReadingPaneOpen: (isOpen) => set({ isReadingPaneOpen: isOpen }),

            setFocusedIndex: (index) => set({ focusedIndex: index }),

            setActiveTab: (tab) => set((state) => {
                const filtered = filterEmails(state.emails, tab);
                let nextId: string | null = null;
                let nextIndex = 0;

                // Try to restore last focus for this tab
                const lastId = state.tabHistory[tab];
                if (lastId) {
                    const foundIndex = filtered.findIndex(e => e.id === lastId);
                    if (foundIndex !== -1) {
                        nextId = lastId;
                        nextIndex = foundIndex;
                    } else if (filtered.length > 0) {
                        // History stale, default to first
                        nextId = filtered[0].id;
                        nextIndex = 0;
                    }
                } else if (filtered.length > 0) {
                    // No history, default to first
                    nextId = filtered[0].id;
                    nextIndex = 0;
                }

                return {
                    activeTab: tab,
                    focusedIndex: nextIndex,
                    selectedId: nextId,
                    isReadingPaneOpen: false // Reset on tab switch
                };
            }),

            archiveEmail: async (id) => {
                const previous = get().emails.find(e => e.id === id);
                set((state) => ({
                    emails: state.emails.map((email) =>
                        email.id === id ? { ...email, status: 'done' as const } : email
                    ),
                }));
                try {
                    if (previous) await GmailService.archive(previous.gmailId);
                } catch (error) {
                    if (previous) {
                        set((state) => ({
                            emails: state.emails.map((email) =>
                                email.id === id ? previous : email
                            ),
                        }));
                    }
                    toast('Failed to archive email');
                    console.error('archiveEmail failed:', error);
                }
            },

            setEmailStatus: (id, status) =>
                set((state) => ({
                    emails: state.emails.map((email) =>
                        email.id === id ? { ...email, status } : email
                    ),
                })),

            markAsRead: async (id) => {
                const previous = get().emails.find(e => e.id === id);
                set((state) => ({
                    emails: state.emails.map((email) =>
                        email.id === id ? { ...email, isRead: true } : email
                    ),
                }));
                try {
                    if (previous) await GmailService.markAsRead(previous.gmailId);
                } catch (error) {
                    if (previous) {
                        set((state) => ({
                            emails: state.emails.map((email) =>
                                email.id === id ? previous : email
                            ),
                        }));
                    }
                    toast('Failed to mark email as read');
                    console.error('markAsRead failed:', error);
                }
            },

            addLabel: async (id, label) => {
                const previous = get().emails.find(e => e.id === id);
                set((state) => ({
                    emails: state.emails.map((email) =>
                        email.id === id ? {
                            ...email,
                            labels: [...(email.labels || []), label]
                        } : email
                    ),
                }));
                try {
                    if (previous) await GmailService.modify(previous.gmailId, [label], []);
                } catch (error) {
                    if (previous) {
                        set((state) => ({
                            emails: state.emails.map((email) =>
                                email.id === id ? previous : email
                            ),
                        }));
                    }
                    toast('Failed to add label');
                    console.error('addLabel failed:', error);
                }
            },

            navigateEmail: (index, id) =>
                set((state) => ({
                    focusedIndex: index,
                    selectedId: id,
                    tabHistory: { ...state.tabHistory, [state.activeTab]: id }
                })),

            syncEmails: async () => {
                try {
                    const res = await GmailService.sync();
                    if (res.success && res.count && res.count > 0) {
                        get().fetchEmails();
                    }
                } catch (error) {
                    console.error('syncEmails failed:', error);
                }
            },

            sendEmail: async (payload) => {
                await GmailService.sendEmail(payload);
            },

            fetchEmails: async () => {
                set({ isLoading: true, error: null });
                try {
                    const { data, error } = await supabase
                        .from('emails')
                        .select('*')
                        .order('internal_date', { ascending: false });

                    if (error) throw error;

                    // Map DB keys to CamelCase for Store
                    const mappedEmails: Email[] = (data || []).map((e: any) => ({
                        id: e.id,
                        gmailId: e.gmail_id,
                        threadId: e.thread_id,
                        historyId: e.history_id,
                        internalDate: Number(e.internal_date),
                        subject: e.subject || '(No Subject)',
                        snippet: e.snippet || '',
                        senderName: e.sender_name || 'Unknown',
                        senderEmail: e.sender_email || '',
                        status: e.status as any,
                        isRead: e.is_read,
                        labels: e.labels || [], // Map labels
                        createdAt: e.created_at,
                        updatedAt: e.updated_at,
                        payload: e.payload // Includes body
                    }));

                    set({ emails: mappedEmails, isLoading: false });

                } catch (error) {
                    console.error('Fetch Emails Error:', error);
                    set({ error: (error as Error).message, isLoading: false });
                }
            },
        }),
        { name: 'MailStore' }
    )
);
