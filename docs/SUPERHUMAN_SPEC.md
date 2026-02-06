# Superhuman: The Fastest Email Experience

Superhuman is a premium email client designed for professionals who live in their inbox. It is built from the ground up to be the fastest, most efficient, and most delightful way to manage email.

## 1. Product Philosophy

Superhuman's core goal is to help users reach **Inbox Zero** with maximum speed and minimum stress. Its philosophy rests on three pillars:

-   **Speed as a Primary Feature**: Every interaction must feel instantaneous (the "100ms rule"). If a user has to wait, their flow is broken.
-   **Keyboard-Centric Design**: Moving from keyboard to mouse is a context switch that slows users down. Superhuman is designed to be operated 100% via keyboard.
-   **Flow and Focus**: The UI is minimal and distraction-free. The goal is to keep the user in "the zone"—a state of high productivity where the tool disappears and only the work remains.

## 2. Achieving the Philosophy

Superhuman achieves its goals through a rigorous focus on performance and UX:

-   **The 100ms Rule**: Every action—opening an email, archiving, searching—happens in under 100 milliseconds.
-   **Visual Polish**: A clean, elegant interface that feels premium.
-   **Flow-State Engineering**: By reducing friction (no loading spinners, no cluttered menus), it allows users to process emails as fast as they can think.
-   **Triage-First Workflow**: Instead of just reading, users are encouraged to *triage*: Archive, Snooze, or Reply.

## 3. Core Feature Set

### Navigation & Command
-   **Keyboard Shortcuts**: Every action has a shortcut. 'C' for compose, 'E' for archive, '#' for delete, 'V' for move to folder.
-   **Command Bar (Cmd+K)**: A central "search for actions" bar. If you don't know the shortcut, Cmd+K lets you type the action.
-   **Superhuman Search**: Instant search across all accounts, optimized for speed.

### Inbox Organization
-   **Split Inboxes**: Divide your inbox into streams (e.g., "Team", "Calendar", "Newsletters") to focus on what matters most.
-   **Inbox Zero**: A "reward" screen with beautiful imagery when the inbox is empty.

### Power Features
-   **Snippets**: Pre-written templates with variables (e.g., `{first_name}`) for rapid drafting.
-   **Remind Me**: Snooze emails to a later time or date. "Remind me if no reply in 2 days."
-   **Send Later**: Schedule emails to reach recipients at the perfect time.
-   **Read Receipts**: See when and where your emails were opened.
-   **Undo Send**: A small window to recall an email after hitting send.

### AI & Intelligence
-   **Superhuman AI**: Summarizes long threads, drafts replies based on your voice, and corrects grammar/tone.
-   **Social Profiles**: Instant context on who you're emailing via LinkedIn and Twitter integrations.

## 4. User Stories

| Role | User Story |
| :--- | :--- |
| **Executive** | "As an executive, I receive 200+ emails a day. I need to triage them in 30 minutes so I can focus on leading my company." |
| **Founder** | "As a founder, I do a lot of outbound. I need snippets and read receipts to manage my investor and sales pipeline efficiently." |
| **Project Manager** | "As a PM, I need to schedule follow-ups and meetings without leaving my inbox to ensure nothing falls through the cracks." |
| **Email Power User** | "As someone who hates using a mouse, I want to use shortcuts for everything so my hands never leave the home row." |

## 5. Technical Implementation Details

Superhuman is a marvel of web engineering, often pushing the boundaries of what browsers can do:

-   **Frontend Architecture**: Built with **React** and a highly optimized **Redux** store to manage state without latency.
-   **Offline First**:
    -   **Service Workers**: Handle background sync and asset caching.
    -   **Local Database**: Uses **WebSQL** and **IndexedDB** to store thousands of emails locally for instant access.
    -   **Modifier Queues**: Actions are applied locally first (optimistic UI), then queued for the server. This ensures the app never waits for the network.
-   **Custom Connection Detection**: A robust system to detect "lie-fi" (connected to Wi-Fi but no internet) and handle intermittent connectivity gracefully.
-   **Asset Optimization**: Attachments are pre-downloaded in the background so they open instantly.

## 6. Relevance to Flowstate

Flowstate's mission to create a "keyboard-first, fast, efficient tool" aligns perfectly with Superhuman's design language. Integrating a mail client into Flowstate using these principles means:
1.  **Shared Hotkey Engine**: Use the same hotkey logic for tasks and emails.
2.  **Universal Command Palette**: Extend the existing Cmd+K to include mail actions.
3.  **Unified Flow**: Moving between "Today's Tasks" and "Urgent Emails" without context switching.
