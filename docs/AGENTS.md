# AGENTS.md - AI Coding Agent Guidelines

> This file provides context and instructions for AI coding agents working on this codebase.
> It helps prevent common mistakes like code duplication, feature bloat, and architectural drift.

## Project Overview

**Flowstate** is a keyboard-driven task management application inspired by modern productivity tools.

> 📘 **Required Reading**: Before making changes, read [`PRODUCT_BRIEF.md`](./PRODUCT_BRIEF.md) to understand the product vision, target users, and user stories.

| Aspect | Details |
|--------|---------|
| **Stack** | React 19, TypeScript, Vite, Zustand |
| **Backend** | Supabase (Auth, Database, Edge Functions) |
| **Styling** | Vanilla CSS |
| **AI Integration** | Google Gemini API |

## Project Structure

```
flowstate/
├── docs/                # Project documentation (Product briefs, Specs)
├── src/                 # Source code
│   ├── App.tsx          # Main app component, global keyboard handlers
│   ├── components/      # React components
│   │   ├── TaskList/    # Split task list module
│   │   │   ├── TaskItem.tsx
│   │   │   ├── useTaskListKeyboard.ts
│   │   │   └── ...
│   │   ├── CoachChat.tsx
│   │   ├── CommandPalette.tsx
│   │   └── ...
│   ├── store/           # Zustand state management
│   │   ├── useTaskStore.ts
│   │   ├── useUIStore.ts
│   │   └── useCoachStore.ts
│   ├── utils/
│   │   ├── supabase.ts
│   │   ├── gemini.ts
│   │   └── nlp.ts
│   └── types.ts         # TypeScript interfaces
└── ...
```

---

## ⛔ NEVER DO

These actions are **categorically off-limits**:

1. **Never commit secrets or API keys** - All sensitive data goes in `.env.local`
2. **Never modify database schemas without explicit approval** - Ask first
3. **Never delete or rename existing components without discussion**
4. **Never add new npm dependencies without justification** - Prefer existing solutions
5. **Never bypass TypeScript strict mode** - Fix type errors properly, no `any` escape hatches
6. **Never duplicate existing functionality** - Check first if similar code exists

---

## ⚠️ ASK FIRST

Request explicit approval before:

1. **Architectural changes** - New patterns, folder restructuring
2. **Database migrations** - Schema changes, new tables
3. **New external integrations** - APIs, services
4. **Removing features** - Even if they seem unused
5. **Major refactoring** - Changes spanning 3+ files
6. **Adding new state management patterns** - Zustand store modifications

---

## ✅ ALWAYS DO

1. **Plan before coding** - Propose an approach, get approval, then implement
2. **Check for existing code** - Search before writing new utilities/components
3. **Follow existing patterns** - Match the style of surrounding code
4. **Run type checking** - Ensure `npx tsc --noEmit` passes
5. **Test locally** - Verify changes work with `npm run dev`
6. **Make minimal changes** - Only change what's necessary for the task
7. **Document non-obvious decisions** - Add comments explaining "why"

---

## Common Mistakes to Avoid

### 1. Code Duplication
Before creating new functions, search for existing implementations:
```bash
# Search for existing utilities
grep -r "functionName" --include="*.ts" --include="*.tsx"
```

**Examples of code that already exists:**
- Task CRUD operations → `src/store/useTaskStore.ts`
- Date parsing → `src/utils/nlp.ts` (uses chrono-node)
- Supabase queries → `src/store/useTaskStore.ts`

### 2. Feature Bloat
- Focus ONLY on the requested feature
- Do NOT add "nice to have" features unless explicitly asked
- Do NOT refactor unrelated code while making changes
- Keep scope minimal and focused

### 3. Conflicting Patterns
- **State**: All state goes through Zustand stores, not React state for shared data
- **Keyboard shortcuts**: Register in `App.tsx` `handleKeyDown`, not in individual components
- **Styling**: Use existing CSS classes from `index.css` before creating new ones
- **Toast notifications**: Use `useUIStore().addToast()` for user feedback

### 4. Breaking Existing Features
Always verify these still work after changes:
- [ ] Keyboard navigation (arrows, enter, escape)
- [ ] Task CRUD operations
- [ ] Multi-select with Shift
- [ ] Drag-and-drop reordering
- [ ] Quick add (Cmd+K)
- [ ] Authentication flow

---

## Code Style Guidelines

### TypeScript
- Use explicit types, avoid `any`
- Prefer interfaces over types for objects
- Use `Task` type from `types.ts` for task objects

### React
- Functional components only
- Use hooks for state and effects
- Memoize expensive computations with `useMemo`
- Use `useCallback` for event handlers passed as props

### Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `TaskList.tsx` |
| Hooks | camelCase with `use` prefix | `useTaskStore.ts` |
| Utilities | camelCase | `parseDate()` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRIES` |

---

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run on specific port
npm run dev -- --port 3001

# Type check
npx tsc --noEmit

# Build for production
npm run build
```

---

## Key Files Reference

| When working on... | Check these files first |
|-------------------|------------------------|
| Task operations | `src/store/useTaskStore.ts`, `src/types.ts` |
| UI components | `src/components/TaskList/` for patterns |
| Keyboard shortcuts | `src/App.tsx` (handleKeyDown function) |
| Styling | `src/index.css` (design tokens at top) |
| Database queries | `src/store/useTaskStore.ts` |
| Authentication | `src/components/Login.tsx`, `src/App.tsx` |

---

## Git Workflow

- `main` branch should always be deployable
- Use feature branches: `feature/description`
- Commit messages: `type: description` (e.g., `fix: keyboard navigation bug`)
- Push to feature branch, create PR for review

---

## Contact

When in doubt, **ask the user** rather than making assumptions. It's better to clarify requirements than to implement the wrong thing.
