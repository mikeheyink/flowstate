# Mail Client — Code Review vs PRD

> Review date: 2026-02-07
> PRD source: `docs/PRD_MAIL_CLIENT.md` (Phase 2)
> Evaluated against: current `main` branch (HEAD: `6778214`)

---

## Summary

| Category | Total Stories | Done | Partial | Not Started |
|----------|:---:|:---:|:---:|:---:|
| Visual Design / Layout | 6 | 4 | 2 | 0 |
| Reading Experience | 4 | 1 | 1 | 2 |
| Writing Experience | 6 | 1 | 1 | 4 |
| Hotkeys — Global Nav | 3 | 2 | 1 | 0 |
| Hotkeys — List Nav | 4 | 2 | 0 | 2 |
| Hotkeys — Triage Actions | 9 | 3 | 1 | 5 |
| Hotkeys — Composition | 2 | 0 | 0 | 2 |
| Technical Strategy | 4 | 2 | 1 | 1 |
| **TOTAL** | **38** | **15** | **6** | **16** |

**Overall completion: ~39% done, ~16% partial, ~42% not started.**

---

## Detailed Story-by-Story Evaluation

### 1. Visual Design / Layout

#### 1.1 Three-Pane Split View Layout
**PRD**: Left sidebar (60px icons), Middle pane (400px thread list), Right pane (fills remaining).
**Status**: DONE
**Evidence**: `MailSplitView.tsx` — ThreadList animates between full-width and 450px when reading pane opens. Sidebar exists in `TopNav`. Reading pane conditionally slides in with Framer Motion.

#### 1.2 Thread List — 3-Line Density (Sender, Subject, Snippet)
**PRD**: Comfortable but compact, 3 lines per email.
**Status**: DONE
**Evidence**: `ThreadList.tsx` — Renders sender name, subject line, and snippet for each email. Layout uses horizontal arrangement (sender left, subject/snippet center, time right) which is actually a refined version of the 3-line spec.

#### 1.3 Unread State — Bold White text, Blue indicator dot
**PRD**: Unread emails show bold text and blue indicator dot.
**Status**: DONE
**Evidence**: `ThreadList.tsx:58-69` — Unread emails get `font-bold text-slate-900 dark:text-white` for sender, `font-semibold` for subject, and a 1.5px indigo dot next to the subject.

#### 1.4 Read State — Grey text
**PRD**: Read emails show grey/secondary text.
**Status**: DONE
**Evidence**: `ThreadList.tsx:58,65` — Read emails get `font-medium text-slate-600 dark:text-slate-400`.

#### 1.5 Selected State — Blue-tinted background with left border marker
**PRD**: Blue-tinted background with subtle left border marker.
**Status**: PARTIAL
**Evidence**: `ThreadList.tsx:49,53-55` — Selected emails get `bg-indigo-50/50 dark:bg-indigo-900/10` and a left indigo border. However, the selection marker has an extra glow shadow (`shadow-[0_0_8px_rgba(99,102,241,0.5)]`) not in the PRD — minor deviation but functional.

#### 1.6 Typography Hierarchy (Sender, Subject, Time, Snippet sizing)
**PRD**: Specific font sizes (14px sender, 14px subject, 12px time, 13px snippet).
**Status**: PARTIAL
**Evidence**: `ThreadList.tsx` — Uses `text-sm` (~14px) for sender and subject, `text-[11px]` for time (smaller than spec's 12px), `text-xs` for snippet (smaller than spec's 13px). Close but not pixel-exact to the PRD spec.

---

### 2. Reading Experience

#### 2.1 Sanitized HTML Rendering
**PRD**: Use `isomorphic-dompurify` to render safe HTML.
**Status**: DONE
**Evidence**: `ReadingPane.tsx:27-31` — Uses `DOMPurify.sanitize()` with `USE_PROFILES: { html: true }`, `ADD_TAGS: ['style']`, and `ADD_ATTR: ['target']`. Renders via `dangerouslySetInnerHTML`.

#### 2.2 Thread View — Grouped by threadId, chronological, collapsed older messages
**PRD**: Emails grouped by `threadId`, oldest at top, newest at bottom. Older emails collapsed by default, click to expand.
**Status**: NOT STARTED
**Evidence**: `ReadingPane.tsx` shows a single email at a time based on `selectedId`. No thread grouping logic exists. No collapse/expand UI. The store has `threadId` on emails but no grouping is performed anywhere in the UI.

#### 2.3 Reply Box — Always visible at bottom of thread
**PRD**: Reply box always visible at the bottom of the reading pane.
**Status**: PARTIAL
**Evidence**: `ReadingPane.tsx:94-101` — A reply placeholder is rendered at the bottom showing "Press r to reply..." but it is **non-functional**. It's a static div, not an input. Pressing `r` logs to console but does not focus or activate anything (`useHotkeys.ts:303-308`).

#### 2.4 Block External Images (Allow for now, revisit later)
**PRD**: Decision to allow external images for now.
**Status**: NOT STARTED
**Evidence**: No image blocking/allowing logic exists. DOMPurify does not strip `<img>` tags by default, so images are implicitly allowed — which matches the "allow for now" decision. However, there's no setting or toggle for future control. Marking as not started since no deliberate implementation exists.

---

### 3. Writing Experience

#### 3.1 Inline Reply — Minimal textarea at bottom of Reading Pane
**PRD**: Minimal text area at bottom, expands as you type. Default action Reply/Reply All.
**Status**: NOT STARTED
**Evidence**: `ReadingPane.tsx:94-101` renders a placeholder div with "Press r to reply..." but there is no `<textarea>`, no expand-on-type behavior, no recipient auto-fill. The `r` hotkey (`useHotkeys.ts:303-308`) uses `document.querySelector` to try to find a reply box by placeholder attribute and logs to console — it does not open an actual reply interface.

#### 3.2 Inline Reply — Tab to Send, Esc to Discard
**PRD**: `Tab` sends, `Esc` discards/saves draft.
**Status**: NOT STARTED
**Evidence**: No inline reply exists, so no send/discard keybindings exist for it.

#### 3.3 Compose Modal — Triggered by `c` hotkey
**PRD**: `c` hotkey opens centered modal with focused backdrop.
**Status**: DONE
**Evidence**: `useHotkeys.ts:279-281` — `c` key calls `setComposeOpen(true)`. `ComposeModal.tsx` renders a centered modal with backdrop blur. `App.tsx:278` mounts the modal.

#### 3.4 Compose Modal — Fields: To, Cc/Bcc (collapsible), Subject, Body
**PRD**: To, Cc/Bcc (collapsible), Subject, Body fields.
**Status**: PARTIAL
**Evidence**: `ComposeModal.tsx` has To, Subject, and Body fields. **Cc/Bcc fields are missing entirely** — no collapsible section, no UI for adding CC or BCC recipients.

#### 3.5 Compose Modal — Plain Text / Markdown editor, no rich text
**PRD**: Plain text with markdown support, converted to simple HTML on send. No complex rich text toolbar.
**Status**: NOT STARTED
**Evidence**: `ComposeModal.tsx:84-89` renders a plain `<textarea>` — which handles plain text. However, there is **no markdown-to-HTML conversion** on send. The body is sent as-is to `sendEmail()`, and the edge function (`gmail-sync/index.ts:213`) sets `Content-Type: text/html` but sends the raw text without any markdown processing.

#### 3.6 Attachments — Read-only download
**PRD**: Phase 2 scope: users can download attachments. No uploading.
**Status**: NOT STARTED
**Evidence**: No attachment parsing exists. The edge function stores `payload.body` but does not extract attachment parts from the MIME tree. `ReadingPane.tsx` does not render attachment lists. `ComposeModal.tsx` renders a `<Paperclip>` icon button but it has **no handler** — phantom UI.

---

### 4. Hotkeys — Global Navigation

#### 4.1 `g` then `i` — Go to Inbox
**PRD**: G-chord navigation to Inbox.
**Status**: PARTIAL
**Evidence**: `useHotkeys.ts:150-163` — G-chord is implemented but only for the **tasks view** (`currentView === 'tasks'`). It maps `g+i` to `setFilter('active')` (task inbox), not to switching to Mail inbox. There is no G-chord handler when `currentView === 'mail'`. The PRD intends `g+i` to navigate to the Mail inbox globally.

#### 4.2 `g` then `t` — Go to Tasks
**PRD**: G-chord navigation to Tasks view.
**Status**: DONE
**Evidence**: `useHotkeys.ts:159` — `g+t` maps to `setFilter('today')` in the tasks view. View switching between tasks/mail is handled by `Cmd+Arrow` (`useHotkeys.ts:104-116`).

#### 4.3 `?` — Show Keyboard Shortcuts Overlay
**PRD**: `?` shows shortcuts.
**Status**: DONE
**Evidence**: `useHotkeys.ts:79-81` — `?` calls `setShortcutsOpen(true)`.

---

### 5. Hotkeys — List Navigation

#### 5.1 Arrow Down — Move selection down
**PRD**: Arrow Down moves selection down in thread list.
**Status**: DONE
**Evidence**: `useHotkeys.ts:227-239` — ArrowDown increments `focusedIndex`, calls `navigateEmail` with next filtered email.

#### 5.2 Arrow Up — Move selection up
**PRD**: Arrow Up moves selection up.
**Status**: DONE
**Evidence**: `useHotkeys.ts:250-262` — ArrowUp decrements `focusedIndex`, calls `navigateEmail` with previous filtered email.

#### 5.3 Enter — Focus Reading Pane / Open Thread
**PRD**: Enter opens the reading pane or focuses it.
**Status**: DONE
**Evidence**: `useHotkeys.ts:243-248` — Enter calls `setReadingPaneOpen(true)` when an email is selected.

#### 5.4 `/` — Search (Focus Search Bar)
**PRD**: `/` focuses a search bar.
**Status**: NOT STARTED
**Evidence**: No search bar exists in the mail UI. No hotkey handler for `/` in the mail view. No search filtering logic.

---

### 6. Hotkeys — Triage & Actions

#### 6.1 `e` — Archive
**PRD**: `e` archives the selected email.
**Status**: DONE
**Evidence**: `useHotkeys.ts:266-277` — `e` (or `x`) calls `archiveEmail(selectedId)` and shows toast. Optimistic update in store sets status to `'done'`.

#### 6.2 `#` — Delete (Trash)
**PRD**: `#` deletes/trashes the selected email.
**Status**: NOT STARTED
**Evidence**: No `#` keybinding exists in `useHotkeys.ts`. No `deleteEmail` or `trashEmail` action in `useMailStore`. No trash API call in `GmailService`.

#### 6.3 `u` — Mark as Unread
**PRD**: `u` marks selected email as unread.
**Status**: NOT STARTED
**Evidence**: No `u` keybinding in `useHotkeys.ts`. No `markAsUnread` action in `useMailStore`. `GmailService` has no method to add the UNREAD label back.

#### 6.4 `Shift+I` — Mark as Read
**PRD**: `Shift+I` manually marks selected email as read.
**Status**: NOT STARTED
**Evidence**: No `Shift+I` keybinding in `useHotkeys.ts`. The store has `markAsRead()` and it works via auto-read in `ReadingPane` (1s delay), but there is no manual keyboard trigger.

#### 6.5 `Shift+R` — Label as "To Read"
**PRD**: `Shift+R` applies `FLOWSTATE/ToRead` label.
**Status**: DONE
**Evidence**: `useHotkeys.ts:284-289` — `Shift+R` calls `addLabel(selectedId, 'FLOWSTATE/ToRead')` and shows toast.

#### 6.6 `Shift+Y` — Label as "To Reply"
**PRD**: `Shift+Y` applies `FLOWSTATE/ToReply` label.
**Status**: DONE
**Evidence**: `useHotkeys.ts:292-297` — `Shift+Y` calls `addLabel(selectedId, 'FLOWSTATE/ToReply')` and shows toast.

#### 6.7 `r` — Reply (Opens inline reply)
**PRD**: `r` opens inline reply interface.
**Status**: NOT STARTED
**Evidence**: `useHotkeys.ts:303-308` — Handler exists but only does `console.log('Reply triggered')` and attempts a `document.querySelector` hack that doesn't connect to anything. No functional inline reply exists.

#### 6.8 `a` — Reply All
**PRD**: `a` opens inline reply with all recipients.
**Status**: NOT STARTED
**Evidence**: No `a` keybinding exists anywhere. No Reply All logic. No recipient parsing from email headers.

#### 6.9 `f` — Forward
**PRD**: `f` opens forward modal.
**Status**: NOT STARTED
**Evidence**: No `f` keybinding exists. No forward modal or pre-filled compose logic.

---

### 7. Hotkeys — Composition

#### 7.1 `Cmd+Enter` — Send
**PRD**: `Cmd+Enter` sends the composed email/reply.
**Status**: NOT STARTED
**Evidence**: `ComposeModal.tsx:100` displays the text "Cmd + Enter to send" but **no keyboard handler exists** for this shortcut. The only way to send is clicking the Send button. This is phantom UI — a shortcut hint with no implementation.

#### 7.2 `Esc` — Close/Draft
**PRD**: `Esc` closes compose or saves draft.
**Status**: NOT STARTED
**Evidence**: `useHotkeys.ts:83-93` handles Escape globally for modals/shortcuts, but does NOT check for `isComposeOpen`. The compose modal has no Escape keybinding. Draft saving does not exist.

---

### 8. Technical Strategy

#### 8.1 Label Persistence — Map tabs to real Gmail labels
**PRD**: "To Read" → `FLOWSTATE/ToRead`, "To Reply" → `FLOWSTATE/ToReply`. Edge function creates labels if missing.
**Status**: DONE
**Evidence**: `gmail-sync/index.ts:172-199` — `handleModify` accepts arbitrary label IDs. `ensureLabelExists` (line 258) creates labels if they don't exist. `addLabel` store action syncs to Gmail. `filterEmails` in `useMailStore.ts:61-67` filters by these label names.

#### 8.2 Reply/Send API — Edge function endpoint for sending email
**PRD**: `POST /send-email` with raw MIME message and optional threadId.
**Status**: DONE
**Evidence**: `gmail-sync/index.ts:201-256` — `handleSendEmail` constructs RFC 2822 MIME message, base64url encodes it, and POSTs to Gmail API. Supports threadId and In-Reply-To headers. `GmailService.sendEmail()` calls it. `ComposeModal` uses it.

#### 8.3 HTML Rendering — Scoped CSS / Shadow DOM
**PRD**: Use Shadow DOM or heavily scoped CSS to prevent email styles from breaking app UI.
**Status**: PARTIAL
**Evidence**: `ReadingPane.tsx:87` renders email HTML inside a div with `prose` classes for basic styling. A code comment on line 89 says "We might need a Shadow DOM wrapper eventually." No Shadow DOM or CSS scoping is actually implemented — email styles CAN leak into the app UI.

#### 8.4 Optimistic Updates — Send pattern (fake message → replace on success → restore on failure)
**PRD**: Add fake "Sending..." message, replace on success, restore draft on failure.
**Status**: NOT STARTED
**Evidence**: `useMailStore.sendEmail` (line 207) has a comment "Optimistic Update? Hard to do for a new email" and then just does a raw `await GmailService.sendEmail(payload)` with no optimistic message insertion, no "Sending..." state, and no draft restoration on failure. The compose modal handles its own loading state but doesn't add a fake message to the thread.

---

## Auto-Advance After Archive

**PRD**: Implied by the triage flow — after archiving, selection should move to next email.
**Status**: PARTIAL
**Evidence**: `useHotkeys.ts:272-276` — After archiving, `nextIndex` is calculated but **never used**. The code computes `Math.min(focusedIndex, filtered.length - 2)` and then... does nothing with it. The selection does not actually advance. This is dead code that gives the appearance of implementation without actually working.

---

## Tab Cycling

**PRD**: Not explicitly in hotkey table but implied by the 4-tab structure (Inbox, To Read, To Reply, Other).
**Status**: DONE (via PageUp/PageDown)
**Evidence**: `useHotkeys.ts:207-224` — PageUp/PageDown cycles through tabs. Tab bar header in `MailSplitView.tsx:33` shows "Inbox" label but does not show a visual tab bar with all 4 tabs.

---

## Critical Issues Found

### 1. Phantom UI (3 instances)
- **Reply placeholder** (`ReadingPane.tsx:94-101`): Shows "Press r to reply" but `r` does nothing functional
- **Paperclip button** (`ComposeModal.tsx:95-97`): Renders attachment icon but no handler exists
- **"Cmd + Enter to send"** (`ComposeModal.tsx:100`): Displays shortcut hint but no keyboard handler exists

### 2. Fire-and-Forget API Calls (3 instances)
- `archiveEmail` (`useMailStore.ts:142-145`): No `.catch()`, no rollback on failure
- `markAsRead` (`useMailStore.ts:161-164`): No `.catch()`, no rollback on failure
- `addLabel` (`useMailStore.ts:177-182`): No `.catch()`, no rollback on failure

### 3. Dead Code
- `useHotkeys.ts:272-276`: Auto-advance `nextIndex` is calculated but never applied to state
- `useHotkeys.ts:306`: `document.querySelector('[placeholder*="reply"]')` result is never used
- `ReadingPane.tsx:12`: Comment `// ... (useEffect for markAsRead remains same)` — the actual useEffect was removed but the comment remains

### 4. Missing Escape Handling for Compose
- `useHotkeys.ts:83-93`: Escape handler checks for shortcuts modal, command palette, and quick add — but does NOT check for `isComposeOpen`. The compose modal cannot be closed via keyboard.

---

## Recommended Priority Order for Remaining Work

| Priority | Story | Effort | Impact |
|----------|-------|--------|--------|
| 1 | Fix phantom UI — remove reply hint, paperclip, Cmd+Enter label | Low | High (trust) |
| 2 | Add rollback to archive/markAsRead/addLabel | Low | High (reliability) |
| 3 | Implement `Cmd+Enter` to send in ComposeModal | Low | High (core flow) |
| 4 | Implement `Esc` to close ComposeModal | Low | High (core flow) |
| 5 | Implement auto-advance after archive (wire up dead `nextIndex`) | Low | High (triage speed) |
| 6 | Implement inline reply (`r` hotkey → functional textarea) | Medium | High (core value) |
| 7 | Implement `#` delete/trash | Low | Medium |
| 8 | Implement `u` mark unread / `Shift+I` mark read | Low | Medium |
| 9 | Fix G-chord to work globally (not just tasks view) | Low | Medium |
| 10 | Implement thread grouping + collapse/expand | High | High (reading experience) |
| 11 | Add Cc/Bcc to ComposeModal | Low | Low |
| 12 | Implement `/` search | Medium | Medium |
| 13 | Reply All (`a`) and Forward (`f`) | Medium | Medium |
| 14 | Attachment download | Medium | Low (Phase 2) |
| 15 | Shadow DOM / CSS scoping for email content | Medium | Low |
| 16 | Optimistic send (fake message pattern) | Medium | Low |
| 17 | Markdown-to-HTML conversion on send | Low | Low |
