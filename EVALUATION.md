# FlowState — App Evaluation & User Stories

> Evaluation date: 2026-06-13 · Platform reviewed: macOS
> Scope: code-level review of the current `main` checkout (no live backend exercised).

FlowState bills itself as a **keyboard-first "Focus OS"** — currently a hierarchical task
manager with smart views, an AI coach, and an in-progress mail module. This document
captures what works today, what is stubbed, and the state of each user story, plus the
macOS hotkey migration done in this pass.

---

## 1. Verdict at a glance

| Area | State | Notes |
|------|-------|-------|
| Task management (CRUD, hierarchy, reorder) | ✅ Solid | Store + keyboard + DnD all wired |
| Smart views (Inbox / Today / Upcoming / Review) | ✅ Working | Filter logic in `App.tsx` + `taskSort.ts` |
| Keyboard navigation | ✅ Working (now Mac-correct) | See §3 |
| Command palette (⌘K) | ✅ Working | Contextual + global actions |
| Natural-language dates | ✅ Working | `chrono-node` via `utils/nlp.ts` |
| Undo / redo | ✅ Working | Command history in `useTaskStore` |
| Offline queue + sync | ✅ Working | `pendingOperations` + online status |
| AI Coach (Gemini) | ⚠️ Needs API key | `utils/gemini.ts`, paste-calendar UX present |
| **Mail module** | 🏗️ **Stubbed** | Triage actions are `console.log` only (see §2) |
| Calendar / Chat / Workspace | ⛔ Not started | Roadmap only |
| Test suite | ⚠️ 10 pre-existing failures | `localStorage` undefined in test env (not hotkey-related) |

---

## 2. Known gaps found during review

1. **Mail triage is not implemented.** In `hooks/useHotkeys.ts`, the mail-view actions
   for archive (`x`), mark-read (`r`), and mark-reply (`y`) only `console.log` — no store
   mutation happens. Navigation (↑/↓, view cycling) does work.
2. **`add-tags` (L) and `edit-note` (N) are registered but not implemented** — flagged in
   `utils/hotkeys.ts` with `showInModal: false`. They appear in no UI yet.
3. **Test environment is broken for persisted stores.** 10 tests fail with
   `Cannot read properties of undefined (reading 'setItem')` — zustand's `persist`
   middleware has no `localStorage` in the test setup. This pre-dates this change
   (confirmed via `git stash`) and is unrelated to hotkeys.
4. **Pre-existing TypeScript errors** in `components/TaskList.tsx` (dnd-kit `opacity`
   side-effect type) and `supabase/functions/gmail-sync/index.ts` (Deno globals). Both
   pre-date this change.

---

## 3. macOS hotkey migration (this change)

The app was keyboard-first but its bindings/labels were Windows-centric. Two were
genuinely broken or awkward on macOS; the rest were just mislabeled. Changes:

### Behavioural rebindings

| Action | Before | After | Why |
|--------|--------|-------|-----|
| **Move task up / down** | `Ctrl+↑ / Ctrl+↓` | **`⌥↑ / ⌥↓`** (Option+Arrow) | `Ctrl+↑/↓` is captured by macOS **Mission Control / App Exposé** before the browser sees it — the binding was unreachable. |
| **Cycle views** (sidebar) | `PgUp / PgDn` | **`[ / ]`** | MacBooks have no dedicated PageUp/PageDown keys. (`PgUp/PgDn` still work as a fallback on full keyboards.) |

### Label-only fixes (handlers already accepted ⌘)

All shortcut labels now render with native macOS glyphs in the **Shortcuts modal** and
**Command palette** (both read from the central registry, so they updated automatically):

`Cmd → ⌘`, `Alt → ⌥`, `Shift → ⇧`, `Enter → ↩`, `Delete → ⌫`, `Tab → ⇥`.

So e.g. `Cmd+K → ⌘K`, `Cmd+Shift+V → ⌘⇧V`, `Alt+Shift+→ → ⌥⇧→`, `Shift+Tab → ⇧⇥`.

### Full current macOS shortcut reference

**Navigation**
- `↑ / ↓` — move focus up / down
- `[ / ]` — previous / next view
- `⌥↑ / ⌥↓` — move task up / down
- `← / →` — collapse / expand
- `⌥⇧← / ⌥⇧→` — collapse all / expand all
- `⌘K` — command palette
- `g` then `i / t / r` — go to Inbox / Today / Review

**Creation**
- `↩` — new task
- `⌘↩` — new subtask
- `⌘⇧V` — batch-add from clipboard

**Organization**
- `X` — complete · `⌫` — delete
- `⇥ / ⇧⇥` — indent / outdent
- `D` — set due date
- `1 / 0` — mark / clear importance (dated tasks)

**Editing**
- `E` — edit title · `⌘O` — open links in task
- `⌘Z / ⌘⇧Z` — undo / redo

**View**
- `?` — show shortcuts

### Files touched
- `src/utils/hotkeys.ts` — central registry: glyphs + the two rebindings
- `src/components/TaskList/useTaskListKeyboard.ts` — move-task now triggers on Option (`altKey`)
- `src/hooks/useHotkeys.ts` — view cycling now also accepts `[` / `]`

The single source of truth is `src/utils/hotkeys.ts`; the modal and palette derive from it,
so future label changes only need to happen there.

---

## 4. User stories — status

Mirrors the stories in `docs/PRODUCT_BRIEF.md`, scored against the current code.

### Daily workflow
| # | Story | Status |
|---|-------|--------|
| D1 | Quickly capture tasks | ✅ `↩` → type → `↩` (QuickAdd) |
| D2 | Process inbox to zero | ✅ Date/importance/archive via keyboard + InboxZero state |
| D3 | See only today | ✅ Today view = due-today + starred |
| D4 | Work distraction-free | ✅ Keyboard-driven, minimal chrome |
| D5 | Complete & feel progress | ✅ `X` completes, confetti, moves to Review |

### Weekly workflow
| # | Story | Status |
|---|-------|--------|
| W1 | Review the week | ✅ WeeklyReview groups by ISO week |
| W2 | AI feedback | ⚠️ Works with a Gemini API key (`VITE_GEMINI_API_KEY`) |
| W3 | Tasks in project context | ✅ Hierarchy paths shown |
| W4 | Plan next week w/ context | ⚠️ Coach can ingest a pasted calendar image; depends on key |

### Project management
| # | Story | Status |
|---|-------|--------|
| P1 | Break into subtasks | ✅ `⇥ / ⇧⇥`, unlimited depth |
| P2 | Progress at a glance | ✅ Expand/collapse, child counts |
| P3 | Reorder by priority | ✅ DnD + `⌥↑/⌥↓` (was the broken `Ctrl+Arrow`) |
| P4 | Move between projects | ✅ DnD / indent re-parenting |

### Data & reliability
| # | Story | Status |
|---|-------|--------|
| R1 | Never lose work offline | ✅ Offline queue + sync indicator |
| R2 | Undo mistakes | ✅ `⌘Z / ⌘⇧Z` |
| R3 | Try before signup | ✅ Guest mode (local only) |
| R4 | Multi-device | ⚠️ Supabase sync — needs configured project |

### Mail (Phase 1, in progress)
| # | Story | Status |
|---|-------|--------|
| M1 | Navigate mail by keyboard | ✅ ↑/↓ + `[ / ]` tab cycling |
| M2 | Triage (archive/read/reply) | ⛔ Stubbed — `console.log` only |
| M3 | Gmail OAuth + threading | 🏗️ Edge function scaffolded, not wired to UI |

---

## 5. Recommended next steps

1. **Wire up mail triage** — replace the `console.log` stubs in `useHotkeys.ts` with real
   `useMailStore` actions (archive/read/reply); the keys are already reserved.
2. **Fix the test harness** — provide a `localStorage` shim (or `jsdom`/happy-dom global)
   in `src/test/setup.ts` so the persisted-store tests run; 10 currently fail on env, not logic.
3. **Resolve the pre-existing TS errors** before adding strict CI typechecking.
4. **Implement or de-register** the `add-tags` (L) and `edit-note` (N) shortcuts so the
   registry matches reality.
5. Consider a per-OS glyph helper if Windows/Linux support is ever desired again (the
   registry is the natural place for it).
