import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

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
                return new Response(JSON.stringify({ message: 'Not implemented' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

            case 'read':
                return await handleModify(google_token, payload.messageId, [], ['UNREAD'])

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
    // A. List Messages (Inbox only)
    const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=label:INBOX&maxResults=20`,
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
    // Note: Production should use batch API, but parallel fetch is fine for <20 items
    const details = await Promise.all(messages.map(async (msg: any) => {
        const res = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
            { headers: { Authorization: `Bearer ${token}` } }
        )
        return res.ok ? await res.json() : null
    }))

    // C. Transform & Upsert
    const upsertRows = details
        .filter(d => d) // Remove failed fetches
        .map(email => transformEmail(email, userId))

    const { error } = await supabase
        .from('emails')
        .upsert(upsertRows, { onConflict: 'gmail_id' })

    if (error) throw error

    return new Response(
        JSON.stringify({ success: true, count: upsertRows.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}

async function handleModify(token: string, messageId: string, addLabels: string[], removeLabels: string[]) {
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

// --- UTILS ---

function transformEmail(gmailData: any, userId: string) {
    const headers = gmailData.payload.headers
    const getHeader = (name: string) => headers.find((h: any) => h.name === name)?.value || ''

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
        payload: { mimeType: gmailData.payload.mimeType }
    }
}
