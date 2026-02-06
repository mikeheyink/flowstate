import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

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

export const filterEmails = (emails: Email[], tab: MailTab) => {
    switch (tab) {
        case 'inbox':
            // Inbox = Status 'inbox' AND (Has CATEGORY_PERSONAL OR No Category Label)
            return emails.filter((e) => e.status === 'inbox' && (e.labels?.includes('CATEGORY_PERSONAL') || !e.labels?.some(l => l.startsWith('CATEGORY_'))));

        case 'to_read': return emails.filter((e) => e.status === 'to_read');
        case 'to_reply': return emails.filter((e) => e.status === 'to_reply');
        case 'other': default: return emails;
    }
};

// Store state
interface MailState {
    emails: Email[];
    selectedId: string | null;
    focusedIndex: number;
    activeTab: MailTab;
    tabHistory: Record<string, string>;
    isLoading: boolean;
    error: string | null;

    // Actions
    setEmails: (emails: Email[]) => void;
    setSelectedId: (id: string | null) => void;
    setFocusedIndex: (index: number) => void;
    setActiveTab: (tab: MailTab) => void;
    archiveEmail: (id: string) => void;
    setEmailStatus: (id: string, status: Email['status']) => void;
    markAsRead: (id: string) => void;
    navigateEmail: (index: number, id: string) => void;
    fetchEmails: () => Promise<void>;
    syncEmails: () => Promise<void>;
}

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

            setEmails: (emails) => set({ emails }),

            setSelectedId: (id) => set((state) => ({
                selectedId: id,
                tabHistory: id ? { ...state.tabHistory, [state.activeTab]: id } : state.tabHistory
            })),

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
                    selectedId: nextId
                };
            }),

            archiveEmail: (id) => {
                // Optimistic Update
                set((state) => ({
                    emails: state.emails.map((email) =>
                        email.id === id ? { ...email, status: 'done' } : email
                    ),
                }));
                // Async Background Action
                import('../services/gmail').then(({ GmailService }) => {
                    const email = get().emails.find(e => e.id === id);
                    if (email) GmailService.archive(email.gmailId);
                });
            },

            setEmailStatus: (id, status) =>
                set((state) => ({
                    emails: state.emails.map((email) =>
                        email.id === id ? { ...email, status } : email
                    ),
                })),

            markAsRead: (id) => {
                set((state) => ({
                    emails: state.emails.map((email) =>
                        email.id === id ? { ...email, isRead: true } : email
                    ),
                }));
                import('../services/gmail').then(({ GmailService }) => {
                    const email = get().emails.find(e => e.id === id);
                    if (email) GmailService.markAsRead(email.gmailId);
                });
            },

            navigateEmail: (index, id) =>
                set((state) => ({
                    focusedIndex: index,
                    selectedId: id,
                    tabHistory: { ...state.tabHistory, [state.activeTab]: id }
                })),

            syncEmails: async () => {
                // Trigger Background Sync (Edge Function)
                // This function uses the stored refresh token on the server.
                import('../services/gmail').then(async ({ GmailService }) => {
                    console.log('Starting background sync...');
                    const res = await GmailService.sync();
                    console.log('Sync result:', res);

                    if (res.success && res.count && res.count > 0) {
                        // Re-fetch to show new emails
                        get().fetchEmails();
                    }
                });
            },

            fetchEmails: async () => {
                set({ isLoading: true, error: null });
                try {
                    // 1. Fetch from Supabase DB (Cache)
                    const { supabase } = await import('../utils/supabase');
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
                        updatedAt: e.updated_at
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
