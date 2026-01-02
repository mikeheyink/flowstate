# Keyboard-First To-Do Application MVP

A high-performance, keyboard-driven to-do application inspired by Linear, Raycast, and Godspeed. Core philosophy: **"Zero Mouse, Total Flow."**

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js 14 (App Router) | React framework |
| Tailwind CSS | Dark-mode styling |
| Zustand | High-speed global state |
| Lucide React | Icons |
| react-hotkeys-hook | Keyboard shortcuts |
| cmdk | Command palette |

---

## Proposed Changes

### Project Initialization

#### [NEW] Next.js Project Setup
Initialize Next.js with TypeScript, Tailwind CSS, and App Router:
```bash
npx -y create-next-app@latest ./ --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

---

### Core State Management

#### [NEW] [store/taskStore.ts](file:///c:/Users/mheyi/.gemini/antigravity/playground/azimuthal-ride/src/store/taskStore.ts)
Zustand store with:
- Task CRUD operations (add, toggle, delete, archive, setPriority)
- History stack for infinite undo (Cmd+Z)
- Optimistic updates for zero-latency feel
- Active task index tracking for Vim navigation

---

### Utilities

#### [NEW] [lib/nlpParser.ts](file:///c:/Users/mheyi/.gemini/antigravity/playground/azimuthal-ride/src/lib/nlpParser.ts)
NLP parser that extracts:
- **Title**: Main task text
- **Due date**: "today", "tomorrow", "next week", specific dates
- **Tags**: `#work`, `#personal`, etc.
- **Priority**: "high priority", "urgent", "p1/p2/p3"

Example: `"Email Sarah tomorrow #work"` → `{ title: "Email Sarah", dueDate: tomorrow, tags: ["work"] }`

---

### Components

#### [NEW] [components/CommandPalette.tsx](file:///c:/Users/mheyi/.gemini/antigravity/playground/azimuthal-ride/src/components/CommandPalette.tsx)
Command palette (Cmd+K) using `cmdk`:
- Search tasks by title
- Actions: Archive, Delete, Set Priority
- Theme switching
- Keyboard-navigable list

#### [NEW] [components/TaskList.tsx](file:///c:/Users/mheyi/.gemini/antigravity/playground/azimuthal-ride/src/components/TaskList.tsx)
Main task list with:
- Vim-style navigation (J/K keys)
- Visual focus indicator (left-border accent)
- Single-key shortcuts (X, D, E, 1-3)
- Smooth transitions

#### [NEW] [components/QuickAdd.tsx](file:///c:/Users/mheyi/.gemini/antigravity/playground/azimuthal-ride/src/components/QuickAdd.tsx)
Quick-add input triggered by `N` key:
- NLP parsing for natural language
- Auto-focus on trigger
- Escape to dismiss

#### [NEW] [components/Toast.tsx](file:///c:/Users/mheyi/.gemini/antigravity/playground/azimuthal-ride/src/components/Toast.tsx)
Non-blocking toast notifications:
- Undo button for destructive actions
- Auto-dismiss after 5 seconds
- Stack multiple toasts

#### [NEW] [components/KeyboardShortcutsHelp.tsx](file:///c:/Users/mheyi/.gemini/antigravity/playground/azimuthal-ride/src/components/KeyboardShortcutsHelp.tsx)
Help modal showing all available shortcuts (triggered by `?`).

---

### Pages

#### [MODIFY] [app/page.tsx](file:///c:/Users/mheyi/.gemini/antigravity/playground/azimuthal-ride/src/app/page.tsx)
Main page composing:
- TaskList
- CommandPalette
- QuickAdd
- Toast container

#### [MODIFY] [app/layout.tsx](file:///c:/Users/mheyi/.gemini/antigravity/playground/azimuthal-ride/src/app/layout.tsx)
Root layout with:
- Dark theme defaults
- Inter font from Google Fonts
- Global keyboard listener setup

#### [MODIFY] [app/globals.css](file:///c:/Users/mheyi/.gemini/antigravity/playground/azimuthal-ride/src/app/globals.css)
Global styles:
- Slate-950 background
- Custom focus rings
- Smooth animations

---

## Keyboard Shortcuts Summary

| Key | Action |
|-----|--------|
| `J` | Move down |
| `K` | Move up |
| `X` | Toggle completion |
| `D` | Delete task |
| `E` | Archive task |
| `1-3` | Set priority |
| `N` | Quick add |
| `Cmd+K` | Command palette |
| `Cmd+Z` | Undo |
| `?` | Show shortcuts help |
| `Esc` | Close modals |

---

## Verification Plan

### Automated Browser Testing
Since this is a keyboard-driven application, I'll verify functionality by:
1. Running `npm run dev` to start the development server
2. Using the browser tool to navigate and test each keyboard shortcut

### Manual Verification Checklist
After implementation, you should verify:

1. **Keyboard Navigation**: Press `J` and `K` to move through tasks, confirm visual focus indicator moves
2. **Quick Add**: Press `N`, type "Buy groceries tomorrow #shopping", press Enter, verify task appears with due date
3. **Task Actions**: Focus a task, press `X` to toggle, `D` to delete (with undo toast), `E` to archive
4. **Priority**: Focus a task, press `1`, `2`, or `3` to set priority levels
5. **Command Palette**: Press `Cmd+K`, search for a task, select an action
6. **Undo**: Perform any action, press `Cmd+Z` to revert
7. **Visual Design**: Confirm dark theme, focus rings, and animations

---

## Folder Structure

```
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── CommandPalette.tsx
│   ├── KeyboardShortcutsHelp.tsx
│   ├── QuickAdd.tsx
│   ├── TaskList.tsx
│   └── Toast.tsx
├── lib/
│   └── nlpParser.ts
└── store/
    └── taskStore.ts
```
