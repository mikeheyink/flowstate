# Mail Client Technical Specification

> **Purpose**: Technical blueprint for implementing the keyboard-first Mail Client in Flowstate.

---

## 1. System Architecture

We will implement a **Hybrid Architecture** to balance the "100ms rule" (Client) with reliability and search (Server).

### A. High-Level Diagram

```mermaid
graph TD
    User[User] -->|Interacts| Client[React Client]
    
    subgraph "Client Layer (100ms Rule)"
        Client -->|Optimistic Updates| Store[useMailStore (Zustand)]
        Client -->|Visual Router| Router[Framer Motion + React Router]
    end
    
    subgraph "Server Layer (Supabase)"
        Store -->|Syncs Actions| DB[(PostgreSQL)]
        Edge[Edge Function: gmail-sync] -->|Writes Emails| DB
        Edge -->|Reads Token| Auth[Supabase Auth]
    end
    
    subgraph "External"
        Edge -->|REST API| Gmail[Gmail API]
    end
```

### B. Component Responsibilities

1.  **React Client**: Render UI, handle hotkeys, optimistic updates.
2.  **`useMailStore` (Zustand)**: Source of truth for frontend. Handles selecting, labeling, and queuing offline mutations.
3.  **Supabase Database**: Caches email headers, snippets, and labels. Stores thread mapping.
4.  **`gmail-sync` (Edge Function)**:
    *   **Ingest**: Polls Gmail API for changes (history ID) and updates our DB.
    *   **Action**: Proxies user actions (archive, send, modify label) to Gmail.

---

## 2. Sliding Views Implementation

We will use a **Route-based approach with Framer Motion**. This allows clear separation of concerns (URLs `/tasks`, `/mail`) while visually simulating a "Spatial OS".

### Technique
*   **Router**: `react-router-dom` remains the URL driver.
*   **Layout**: A `<AnimatePresence mode="wait">` wrapper around the route outlet.
*   **Animation**:
    *   Navigating Right (Tasks -> Mail): `initial={{ x: '100%' }}` -> `animate={{ x: 0 }}`
    *   Navigating Left (Mail -> Tasks): `initial={{ x: '-100%' }}` -> `animate={{ x: 0 }}`
*   **State Preservation**: `zustand` stores persist data even when the component unmounts during route changes, ensuring "instant" feel upon return.

---

## 3. Database Schema

We need new tables to cache email data locally for speed.

### `emails`
Stores individual messages.
```sql
create table emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  gmail_id text unique not null,
  thread_id text not null,
  history_id text,
  internal_date bigint,
  snippet text,
  payload jsonb, -- Simplified structural data (headers, mimeType)
  status text check (status in ('inbox', 'to_read', 'to_reply', 'done', 'trash')),
  created_at timestamptz default now()
);
```

### `threads` (Optional Optimization)
If threading logic is complex, we might normalize it, but for V1 filtering by `thread_id` on the `emails` table is sufficient.

---

## 4. Edge Function: `gmail-sync`

**Location**: `supabase/functions/gmail-sync`

### Responsibilities
1.  **Auth**: Use the User's Supabase Auth Access Token to retrieve their Google OAuth Provider Token.
2.  **Sync**: 
    *   Endpoint: `POST /sync`
    *   Logic: Fetch messages from Gmail `users.messages.list` with query `q=label:INBOX`.
    *   Upsert results into `emails` table.
3.  **Actions**:
    *   Endpoint: `POST /action`
    *   Body: `{ action: 'archive' | 'reply', messageId: '...' }`
    *   Logic: Call Gmail API `users.messages.batchModify` (remove label INBOX) or `users.messages.send`.

---

## 5. Security & Auth
*   **RLS (Row Level Security)**: `emails` table enabled for RLS. Policy: `users can select * where auth.uid() = user_id`.
*   **Google Scopes**: We need to request `https://www.googleapis.com/auth/gmail.modify` scope during sign-in.

---

## 6. Implementation Plan

### Phase 1: Foundation
1.  Initialize `supabase` project structure.
2.  Create `emails` table and RLS policies.
3.  Create skeleton `gmail-sync` function (deployable hello world).

### Phase 2: Frontend Core
1.  Install `framer-motion`.
2.  Create `MailView` component structure.
3.  Implement `AnimatePresence` and routing logic for Sliding Views.

### Phase 3: Store & Mock Data
1.  Create `useMailStore`.
2.  Seed store with mock emails.
3.  Implement Hotkeys (`x`, `Enter`, `Shift+Enter`, `r`, `y`).

### Phase 4: Integration
1.  Implement Google OAuth Token exchange in `gmail-sync`.
2.  Connect Client `sync()` to Edge Function.
3.  Implement "Send Email" flow.
