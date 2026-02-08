# Flowstate Mail Client: Phase 2 PRD

> **Vision**: Transform the Mail Client from a "Viewer" into a "Command Center". It must feel like Superhuman: instant, keyboard-driven, and flow-inducing.

---

## 1. The Interaction Model (Visual Design)

The design must prioritize **Information Density** and **Scannability**.

### A. The "Three-Pane" Layout (Split View)
We typically move from a focused "List" to a "Reading" mode. However, on desktop, a **Split View** is superior for flow.

*   **Left Pane (Navigation)**: 60px Sidebar (Icons only).
*   **Middle Pane (Thread List)**: 400px Fixed width.
    *   **Density**: Comfortable but compact. 3 lines per email (Sender, Subject, Snippet).
    *   **States**:
        *   *Unread*: Bold White text, Blue indicator dot.
        *   *Read*: Grey text (tokens.text.secondary).
        *   *Selected*: Blue-tinted background with a subtle left border marker (`tokens.primary` color).
*   **Right Pane (Reading Pane)**: Fills remaining space.
    *   **Empty State**: "Select an email to read" (or a beautiful "Focus" illustration).
    *   **Content**: Rendered email thread.

### B. Typography & Hierarchy
*   **Sender**: `Inter`, SemiBold, 14px (Primary Color).
*   **Subject**: `Inter`, Regular, 14px (Secondary Color).
*   **Time**: `Inter`, Regular, 12px (Tertiary Color), aligned right.
*   **Snippet**: `Inter`, Regular, 13px (Tertiary Color), truncated.

---

## 2. Core Functional Requirements (Usage)

### A. Reading Experience
*   **Sanitized HTML**: Use `isomorphic-dompurify` to render safe HTML.
*   **Block Images**: By default, block external tracking pixels images? (Decision: **Allow for now** for better UX, revisit for privacy later/settings).
*   **Thread View**:
    *   Emails are grouped by `threadId`.
    *   **Chronological Order**: Oldest at top, Newest at bottom.
    *   **Collapsed State**: Older emails in the thread are collapsed by default. Clicking expands them.
    *   **Reply Box**: Always visible at the bottom of the thread.

### B. Writing Experience (Compose & Reply)
We need a "Modal" for new emails and an "Inline" experience for replies.

#### 1. Inline Reply (The Flow State)
*   **Location**: Always at the bottom of the Reading Pane.
*   **Visual**: Minimal text area. Expands as you type.
*   **Default Action**: "Reply All" (if multiple recipients) or "Reply".
*   **Quick Actions**:
    *   `Tab`: Send.
    *   `Esc`: Discard/Draft.

#### 2. Compose Modal (New Thread)
*   **Trigger**: `c` hotkey.
*   **Visual**: Centered modal, focused backdrop.
*   **Fields**: To, Cc/Bcc (collapsible), Subject, Body.
*   **Editor**: Plain Text (Markdown supported) -> Converted to simple HTML on send. **No complex Rich Text Toolbar** (keeps it fast).

#### 3. Attachments
*   *Scope for Phase 2*: **Read-only**. Users can download attachments. Uploading is Phase 3.

---

## 3. The "Keyboard First" Engine (Hotkeys)

Every action implies a state change. The mouse is forbidden (figuratively).

### A. Global Navigation
| Key | Action | Context |
| :--- | :--- | :--- |
| `g` then `i` | Go to **I**nbox | Global |
| `g` then `t` | Go to **T**asks | Global |
| `?` | Show Keyboard Shortcuts Overlay | Global |

### B. List Navigation (Arrows)
| Key | Action |
| :--- | :--- |
| `Arrow Down` | Move selection Down |
| `Arrow Up` | Move selection Up |
| `Enter` | Focus Reading Pane (in Split View) or Open Thread (in List View) |
| `/` | Search (Focus Search Bar) |

### C. Triage & Actions (Selected Email)
| Key | Action | Concept |
| :--- | :--- | :--- |
| `e` | **Archive** (Done) | Consistent with Task "Done" |
| `#` | **Delete** (Trash) | Destructive |
| `u` | Mark as **Unread** | Keep for later |
| `shift` + `i` | Mark as **Read** | Manual read |
| `shift` + `r` | Label as **"To Read"** | Applies `FLOWSTATE/ToRead` label. Moves email to "To Read" tab. |
| `shift` + `y` | Label as **"To Reply"** | Applies `FLOWSTATE/ToReply` label. Moves email to "To Reply" tab. |
| `r` | **Reply** | Opens inline reply |
| `a` | **Reply All** | Opens inline reply |
| `f` | **Forward** | Opens forward modal |

### D. Composition (While Typing)
| Key | Action |
| :--- | :--- |
| `cmd` + `enter` | **Send** |
| `esc` | Close/Draft |

---

## 4. Technical Strategy (The "How")

### A. Label Persistence
We will not just use local state. We will map Tabs to real Gmail Labels so state persists across devices and reloads.
*   **"To Read"**: Create/Apply Gmail Label `FLOWSTATE/ToRead`.
*   **"To Reply"**: Create/Apply Gmail Label `FLOWSTATE/ToReply`.
*   **Edge Function Update**: `gmail-sync` must create these labels if missing during sync, and `handleModify` needs to accept arbitrary label IDs.

### B. The "Reply" API
The current `gmail-sync` Edge Function needs an update.
*   **Endpoint**: `POST /send-email`
*   **Payload**: `{ raw: "base64_encoded_mime_message", threadId: "..." }`
*   **Library**: Use `nodemailer` (or manual MIME construction) in the Edge Function to build RFC 2822 compliant messages.

### C. HTML Rendering
*   **Component**: Create `<EmailContent content={html} />`.
*   **Styles**: Use a Shadow DOM or heavily scoped CSS to prevent email styles from breaking the App UI.

### D. Optimistic Updates
1.  **User hits Send**:
    *   Add a "fake" message to the local store (greyed out, "Sending...").
    *   Clear the input.
2.  **Server Success**:
    *   Replace "fake" message with real one from response.
3.  **Server Failure**:
    *   Show error toast. Restore draft text.

---

## 5. References
*   **[PRODUCT_BRIEF.md](./PRODUCT_BRIEF.md)**: Overall Focus OS vision.
*   **[AGENTS.md](./AGENTS.md)**: Coding standards and architectural constraints.
