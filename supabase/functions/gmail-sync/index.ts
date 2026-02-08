import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import * as nodemailer from "npm:nodemailer@6.9.10";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // 1. Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 2. Validate Auth
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('No authorization header')

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
        if (userError || !user) throw new Error('Unauthorized')

        // 3. Parse Request
        const { action, ...payload } = await req.json()

        // 4. Get Access Token (Server-side)
        const google_token = await getAccessToken(supabaseClient, user.id)

        // 5. Router
        switch (action) {
            case 'sync':
                return await handleSync(supabaseClient, user.id, google_token)

            case 'archive':
                return await handleModify(google_token, payload.messageId, [], ['INBOX'])

            case 'reply':
            case 'send-email':
                return await handleSendEmail(google_token, payload)

            case 'read':
                return await handleModify(google_token, payload.messageId, [], ['UNREAD'])

            case 'modify':
                // Generalized modify for "To Read", "To Reply"
                return await handleModify(google_token, payload.messageId, payload.addLabelIds || [], payload.removeLabelIds || [])

            default:
                throw new Error(`Unknown action: ${action}`)
        }

    } catch (error) {
        console.error(error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

// --- AUTH HELPER ---

async function getAccessToken(supabase: any, userId: string) {
    // 1. Get Refresh Token from DB
    const { data, error } = await supabase
        .from('google_tokens')
        .select('refresh_token')
        .eq('user_id', userId)
        .single()

    if (error || !data?.refresh_token) {
        throw new Error('No Google authorization found. Please sign in again.')
    }

    const clientId = Deno.env.get('GMAIL_CLIENT_ID')
    const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
        throw new Error('Server Config Error: Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET')
    }

    // 2. Exchange for Access Token
    const params = new URLSearchParams()
    params.append('client_id', clientId)
    params.append('client_secret', clientSecret)
    params.append('refresh_token', data.refresh_token)
    params.append('grant_type', 'refresh_token')

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
    })

    if (!res.ok) {
        const txt = await res.text()
        console.error('Google Token Error:', txt)
        throw new Error('Failed to refresh Google Access Token')
    }

    const tokenData = await res.json()
    return tokenData.access_token
}

// --- GMAIL HELPER FUNCTIONS ---

async function handleSync(supabase: any, userId: string, token: string) {
    // A. List Messages (Broaden scope to catch labelled emails too, not just INBOX)
    // We check INBOX, STARRED, and our custom labels.
    // For now, let's just grab the last 50 messages regardless of label to ensure we sync state correctly
    // Or stick to INBOX to keep it fast, but we need to see "To Read" items if they are archived.
    // DECISION: Sync INBOX + custom labels. Construction query is complex.
    // SIMPLE V2: Just sync INBOX for speed. "To Read" items should optimally stay in Inbox or we sync that label specifically.
    // Let's stick to INBOX for the main loop, plus specific label checks if needed?
    // ACTUALLY: If we move something to "To Read" and Archive it, it disappears from this sync query.
    // We should allow the UI to optimistic update, but eventually we need a "Sync All" strategy.
    // For Phase 2, let's keep querying 'label:INBOX' but increase limit.
    // User requested "To Read" tab. If they archive it, it won't show up here.
    // We will expand query: 'label:INBOX OR label:FLOWSTATE/ToRead OR label:FLOWSTATE/ToReply'

    const query = 'label:INBOX OR label:FLOWSTATE/ToRead OR label:FLOWSTATE/ToReply';
    const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=30`,
        { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!listRes.ok) {
        const err = await listRes.text();
        throw new Error(`Gmail List API Error: ${err}`)
    }

    const listData = await listRes.json()
    const messages = listData.messages || []

    if (messages.length === 0) {
        return new Response(JSON.stringify({ count: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // B. Fetch Details (Parallel)
    const details = await Promise.all(messages.map(async (msg: any) => {
        const res = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
            { headers: { Authorization: `Bearer ${token}` } }
        )
        return res.ok ? await res.json() : null
    }))

    // C. Transform & Upsert
    const upsertRows = details
        .filter(d => d)
        .map(email => transformEmail(email, userId))

    // Insert new emails (ignore conflicts — existing rows are untouched)
    const { error: insertError } = await supabase
        .from('emails')
        .upsert(upsertRows, { onConflict: 'gmail_id', ignoreDuplicates: true })

    if (insertError) throw insertError

    // Update existing emails: refresh content but preserve client-managed `status`
    for (const row of upsertRows) {
        const { status, ...fieldsToUpdate } = row
        const { error: updateError } = await supabase
            .from('emails')
            .update(fieldsToUpdate)
            .eq('gmail_id', row.gmail_id)
            .eq('user_id', userId)
        if (updateError) {
            console.error(`Failed to update email ${row.gmail_id}:`, updateError)
        }
    }

    return new Response(
        JSON.stringify({ success: true, count: upsertRows.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}

async function handleModify(token: string, messageId: string, addLabels: string[], removeLabels: string[]) {
    // 1. Ensure labels exist (Idempotent)
    // We only care about ensuring our custom labels exist if we are adding them.
    for (const label of addLabels) {
        if (label.startsWith('FLOWSTATE/')) {
            await ensureLabelExists(token, label);
        }
    }

    const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ addLabelIds: addLabels, removeLabelIds: removeLabels })
        }
    )

    if (!res.ok) throw new Error(`Gmail Modify API Error: ${await res.text()}`)

    return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}

async function handleSendEmail(token: string, payload: any) {
    const { to, cc, bcc, subject, body, threadId, replyToMessageId } = payload;

    const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
    const messageParts = [
        `To: ${to}`,
    ];
    if (cc) messageParts.push(`Cc: ${cc}`);
    if (bcc) messageParts.push(`Bcc: ${bcc}`);
    messageParts.push(
        `Subject: ${utf8Subject}`,
        `Content-Type: text/html; charset=utf-8`,
        `MIME-Version: 1.0`,
    );

    if (threadId && replyToMessageId) {
        messageParts.push(`In-Reply-To: ${replyToMessageId}`);
        messageParts.push(`References: ${replyToMessageId}`);
    }

    messageParts.push(``);
    messageParts.push(body);

    const rawMessage = messageParts.join('\r\n');
    const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                raw: encodedMessage,
                threadId: threadId // Optional: Threading
            })
        }
    )

    if (!res.ok) {
        throw new Error(`Gmail Send API Error: ${await res.text()}`)
    }

    const data = await res.json();

    return new Response(
        JSON.stringify({ success: true, id: data.id, threadId: data.threadId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}

async function ensureLabelExists(token: string, labelName: string) {
    // 1. Check if exists
    const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/labels`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    const listData = await listRes.json();
    const exists = listData.labels?.some((l: any) => l.name === labelName || l.id === labelName); // Id match too?

    if (!exists) {
        // 2. Create
        await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/labels`,
            {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: labelName, labelListVisibility: 'labelShow', messageListVisibility: 'show' })
            }
        )
    }
}


// --- UTILS ---

function transformEmail(gmailData: any, userId: string) {
    const headers = gmailData.payload.headers
    const getHeader = (name: string) => headers.find((h: any) => h.name === name)?.value || ''

    // Find HTML or Text body
    let body = '';
    if (gmailData.payload.body?.data) {
        body = gmailData.payload.body.data;
    } else if (gmailData.payload.parts) {
        const htmlPart = gmailData.payload.parts.find((p: any) => p.mimeType === 'text/html');
        const textPart = gmailData.payload.parts.find((p: any) => p.mimeType === 'text/plain');
        body = htmlPart?.body?.data || textPart?.body?.data || '';
    }

    // Decode Body
    try {
        body = atob(body.replace(/-/g, '+').replace(/_/g, '/'));
    } catch (e) {
        // Fallback for non-base64 or invalid
    }

    return {
        user_id: userId,
        gmail_id: gmailData.id,
        thread_id: gmailData.threadId,
        history_id: gmailData.historyId,
        internal_date: parseInt(gmailData.internalDate),
        snippet: gmailData.snippet,
        subject: getHeader('Subject'),
        sender_name: getHeader('From').split('<')[0].trim().replace(/"/g, ''),
        sender_email: getHeader('From').match(/<(.+)>/)?.[1] || getHeader('From'),
        status: 'inbox',
        is_read: !gmailData.labelIds.includes('UNREAD'),
        labels: gmailData.labelIds || [], // Store all labels (CATEGORY_*, etc)
        payload: {
            mimeType: gmailData.payload.mimeType,
            body: body,
            to: getHeader('To'),
            cc: getHeader('Cc'),
            messageId: getHeader('Message-ID'),
        }
    }
}
