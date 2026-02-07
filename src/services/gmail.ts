import { supabase } from '../utils/supabase';

export interface SyncResponse {
    success: boolean;
    count?: number;
    error?: string;
}

export const GmailService = {
    /**
     * Calls the `gmail-sync` Edge Function to fetch emails from Gmail and save to DB.
     * Auth is handled server-side using stored Refresh Token.
     */
    async sync(): Promise<SyncResponse> {
        const { data, error } = await supabase.functions.invoke('gmail-sync', {
            body: { action: 'sync' }
        });

        if (error) {
            console.error('Gmail Sync Error:', error);
            return { success: false, error: error.message };
        }

        return data as SyncResponse;
    },

    /**
     * Archives an email (removes INBOX label).
     */
    async archive(messageId: string): Promise<SyncResponse> {
        const { data, error } = await supabase.functions.invoke('gmail-sync', {
            body: {
                action: 'archive',
                messageId
            }
        });

        if (error) {
            console.error('Gmail Archive Error:', error);
            return { success: false, error: error.message };
        }

        return data as SyncResponse;
    },

    /**
     * Marks an email as read (removes UNREAD label).
     */
    async markAsRead(messageId: string): Promise<SyncResponse> {
        const { data, error } = await supabase.functions.invoke('gmail-sync', {
            body: {
                action: 'read',
                messageId
            }
        });

        if (error) {
            console.error('Gmail MarkRead Error:', error);
            return { success: false, error: error.message };
        }

        return data as SyncResponse;
    },

    /**
     * Modifies labels for an email (add/remove).
     */
    async modify(messageId: string, addLabelIds: string[], removeLabelIds: string[]): Promise<SyncResponse> {
        const { data, error } = await supabase.functions.invoke('gmail-sync', {
            body: {
                action: 'modify',
                messageId,
                addLabelIds,
                removeLabelIds
            }
        });

        if (error) {
            console.error('Gmail Modify Error:', error);
            return { success: false, error: error.message };
        }

        return data as SyncResponse;
    },

    /**
     * Trashes an email (adds TRASH label, removes INBOX label).
     */
    async trash(messageId: string): Promise<SyncResponse> {
        return this.modify(messageId, ['TRASH'], ['INBOX']);
    },

    /**
     * Marks an email as unread (adds UNREAD label).
     */
    async markAsUnread(messageId: string): Promise<SyncResponse> {
        return this.modify(messageId, ['UNREAD'], []);
    },

    /**
     * Sends a new email or reply.
     */
    async sendEmail(payload: { to: string; subject: string; body: string; threadId?: string; replyToMessageId?: string }): Promise<SyncResponse> {
        const { data, error } = await supabase.functions.invoke('gmail-sync', {
            body: {
                action: 'send-email',
                ...payload
            }
        });

        if (error) {
            console.error('Gmail Send Error:', error);
            return { success: false, error: error.message };
        }

        return data as SyncResponse;
    }
};
