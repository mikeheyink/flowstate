# Flowstate Mail Client: PRD

> **One-line vision**: Process your entire inbox in 15 minutes without touching the mouse — then get back to deep work.

---

## 1. Success Criteria

| Metric | Target | How We Measure |
|--------|--------|----------------|
| **Email triage speed** | < 2 seconds per decision | Time from selection to action (archive/label/reply) |
| **Keyboard-only sessions** | > 90% of actions | Ratio of hotkey actions to click actions |
| **Reading Pane latency** | < 100ms | Client-side performance measurement |

---

## 2. Interaction Model (The "Shortwave" Experience)

### A. Full-Screen Layout
The mail view utilizes the **full width** of the viewport, removing centered constraints to maximize information density.

### B. Conditional Split View
The interaction model shifts from persistent panes to a context-aware split view.
- **Default State**: A full-width **Thread List**.
- **Opening a Thread**: Pressing `Enter` on a selected email slides in the **Reading Pane** on the right.
- **Closing a Thread**: Pressing `Escape` hides the Reading Pane and returns to the full-list view.
- **Sync**: While the Reading Pane is open, navigating the list with arrow keys updates the content in real-time.

### C. Improved Row Styling
Refactored for scannability and horizontal spacing.
- **Left Column**: Sender Name (Primary).
- **Separator**: Significant horizontal whitespace.
- **Main Column**: 
    - **Top**: Subject Line.
    - **Bottom**: Content Snippet (truncated).

---

## 3. User Stories (Core Loop)

| Priority | Feature | As a user, I want to... | Acceptance Criteria |
|----------|---------|-------------------------|-------------------|
| P0 | **Triage List** | See a full-width list focused on sender and snippet | Sender on left, subject/snippet on right. |
| P0 | **Instant Preview**| Hit `Enter` to open a reading pane and `Esc` to close it | Reading pane visibility toggled by keyboard. |
| P0 | **Fast Triage** | Archive emails with `e` and auto-advance | Action removes item, moves selection to next. |
| P1 | **Labeling** | Use `Shift+R`/`Shift+Y` to defer emails | Gmail labels `FLOWSTATE/ToRead` and `ToReply`. |
| P1 | **Inline Reply** | Reply at the bottom of the reading pane with `r` | Focuses inline textarea, `Cmd+Enter` to send. |

---

## 4. Keyboard Map

| Key | Action | Response |
|-----|--------|----------|
| `Arrow Down/Up` | Navigate List | Moves selection; updates Reading Pane if open |
| `Enter` | Open Thread | Shows Reading Pane (Split View) |
| `Escape` | Close Thread | Hides Reading Pane (Full List View) |
| `e` | Archive | Moves to next; optimistic Gmail update |
| `#` | Delete | Move to trash |
| `r` | Reply | Opens inline reply at bottom of Reading Pane |
| `Shift+R` | "To Read" | Applies label; moves to "To Read" tab |
| `Shift+Y` | "To Reply" | Applies label; moves to "To Reply" tab |
| `c` | Compose | Opens new email modal |
| `/` | Search | Focuses search bar |

---

## 5. Technical Strategy & Data Model
Refer to **[AGENTS.md](./AGENTS.md)** for coding standards and **[SPEC_MAIL_CLIENT.md](./SPEC_MAIL_CLIENT.md)** for detailed API and schema implementation.

---

*This PRD serves as the authoritative specification for the Mail Client feature.*
