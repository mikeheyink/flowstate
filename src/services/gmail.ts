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
    }
};
