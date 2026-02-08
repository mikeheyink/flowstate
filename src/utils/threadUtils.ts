import { Email } from '../store/useMailStore';

export interface Thread {
    threadId: string;
    emails: Email[];
    latestEmail: Email;
    subject: string;
    messageCount: number;
    unreadCount: number;
    latestDate: number;
}

export function groupByThread(emails: Email[]): Thread[] {
    const threadMap = new Map<string, Email[]>();

    for (const email of emails) {
        const existing = threadMap.get(email.threadId);
        if (existing) {
            existing.push(email);
        } else {
            threadMap.set(email.threadId, [email]);
        }
    }

    const threads: Thread[] = [];

    for (const [threadId, threadEmails] of threadMap) {
        const sorted = [...threadEmails].sort((a, b) => a.internalDate - b.internalDate);
        const latestEmail = sorted[sorted.length - 1];

        threads.push({
            threadId,
            emails: sorted,
            latestEmail,
            subject: sorted[0].subject,
            messageCount: sorted.length,
            unreadCount: sorted.filter(e => !e.isRead).length,
            latestDate: latestEmail.internalDate,
        });
    }

    return threads.sort((a, b) => b.latestDate - a.latestDate);
}
