# Offline Data Persistence Options

## Current Problem
Tasks entered while offline are lost on page refresh because:
- Data lives only in memory (Zustand state)
- No local storage fallback
- Supabase calls fail silently when offline

---

## Option 1: Zustand Persist Middleware (Simple)

**How it works**: Use Zustand's built-in `persist` middleware to automatically save state to localStorage.

```typescript
import { persist } from 'zustand/middleware';

const useTaskStore = create(
  persist(
    (set, get) => ({ /* store logic */ }),
    { name: 'flowstate-tasks' }
  )
);
```

| Pros | Cons |
|------|------|
| ✅ 5 minutes to implement | ❌ No conflict resolution with server |
| ✅ Zero dependencies | ❌ Can get out of sync with Supabase |
| ✅ Works immediately | ❌ No retry queue for failed syncs |
| ✅ Survives refresh & offline | ❌ localStorage limit (~5-10MB) |

**Best for**: MVPs, personal apps, low-stakes data

---

## Option 2: localStorage + Offline Queue (Robust)

**How it works**: Persist to localStorage AND queue failed Supabase operations for retry.

```
User Action → Update State → Save to localStorage → Try Supabase
                                                      ↓
                                              If offline: Queue operation
                                              When online: Retry queue
```

| Pros | Cons |
|------|------|
| ✅ No data loss ever | ⚠️ More complex (~2-3 hours) |
| ✅ Automatic sync on reconnect | ⚠️ Need to handle conflicts |
| ✅ Visual sync status indicator | ⚠️ Queue can grow large |
| ✅ Works with existing Supabase | |

**Best for**: Production apps needing reliability

---

## Option 3: Service Worker + IndexedDB (PWA)

**How it works**: Full PWA with service worker caching responses and IndexedDB for structured data.

| Pros | Cons |
|------|------|
| ✅ True offline-first app | ❌ Complex setup (~1-2 days) |
| ✅ Large storage capacity | ❌ Service worker debugging is hard |
| ✅ Can work without network | ❌ Overkill for this use case |
| ✅ Installable on mobile | |

**Best for**: Apps requiring full offline functionality

---

## Option 4: Supabase Realtime + Local Cache (Enterprise)

**How it works**: Use Supabase Realtime subscriptions with a local-first library like PowerSync or ElectricSQL.

| Pros | Cons |
|------|------|
| ✅ Real-time sync across devices | ❌ Additional service costs |
| ✅ Automatic conflict resolution | ❌ Significant refactor |
| ✅ Battle-tested sync algorithms | ❌ Vendor lock-in |

**Best for**: Multi-device apps, team collaboration

---

## Recommendation

| Your Situation | Recommended Option |
|----------------|-------------------|
| **MVP / Personal use** | **Option 1** - Quick win, 5 min |
| **Production app** | **Option 2** - Best balance |
| **Offline-critical** | Option 3 - Full PWA |
| **Multi-user sync** | Option 4 - Enterprise |

### My Suggestion: **Option 2 (localStorage + Offline Queue)**

This gives you:
1. **Immediate persistence** - Never lose data on refresh
2. **Automatic sync** - Queued operations retry when online
3. **Visual feedback** - User knows sync status
4. **Reasonable complexity** - ~2-3 hours to implement

---

## Implementation Scope (Option 2)

```
[x] Zustand persist middleware for localStorage
[x] Offline detection hook
[x] Operation queue for failed syncs
[x] Retry logic on reconnect
[x] Sync status indicator in UI
[ ] Conflict resolution (optional - last-write-wins is fine for single user)
```
