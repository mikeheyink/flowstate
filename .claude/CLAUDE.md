# CLAUDE.md — AI Coding Agent Guidelines

> **Purpose**: This document governs how AI coding agents operate in this codebase. Every agent MUST read this file in full before writing a single line of code. It exists because AI agents make predictable, preventable mistakes — and this document eliminates them.

---

## The Golden Rule

**Read before you write.**

Before implementing ANY feature:

1. Search the codebase for existing code that does something similar
2. Read the file you're about to modify — in full
3. Identify the patterns already established and follow them exactly
4. If no pattern exists, propose one and get approval before coding

AI agents that skip this step produce code that looks correct in isolation but conflicts with the existing architecture. This is the #1 cause of project failure.

---

## ⛔ NEVER DO

These are hard rules. Violating any of these is grounds for rejecting the entire changeset.

### Code Quality

1. **Never use `any`** — Use `unknown` and type-narrow, or define proper interfaces. Every `any` is a bug waiting to happen. This includes `as any` casts.
2. **Never leave TODO comments** — Either implement it now or explicitly exclude it from scope. TODOs accumulate into noise that confuses future sessions.
3. **Never leave dead code** — No commented-out blocks, no unused imports, no variables assigned but never read. Delete it.
4. **Never render UI for unimplemented features** — If a button does nothing, don't render it. No placeholder icons, no shortcut hints without handlers. Users interact with phantom UI and lose trust.
5. **Never use `document.querySelector` in React** — Use refs, context, or store state. DOM queries bypass React's rendering model and break silently.
6. **Never mutate state directly** — No `.push()`, `.pop()`, `.splice()` on state arrays. Always create new references: `[...array]`, `array.filter()`, `array.map()`.

### Architecture

7. **Never duplicate existing patterns** — Search first. If a utility, hook, or helper exists that does what you need, use it. If a store has an established pattern for CRUD, follow it.
8. **Never use dynamic `import()` inside store actions** — Import at module level. Dynamic imports hide circular dependencies, create unhandled promises, and make testing impossible. Fix the dependency graph instead.
9. **Never silently swallow errors** — Every async call must have a `.catch()` or try/catch. Log the error AND surface it to the user. Fire-and-forget API calls are bugs.
10. **Never commit secrets or API keys** — All sensitive data goes in `.env.local` or environment variables.

### Process

11. **Never modify database schemas without explicit approval** — Ask first.
12. **Never add dependencies without justification** — Prefer existing solutions. Every dependency is a maintenance liability.
13. **Never bypass TypeScript strict mode** — Fix type errors properly, don't cast around them.

---

## ⚠️ ASK FIRST

Request explicit approval before:

1. **Architectural changes** — New patterns, folder restructuring, new stores
2. **Database migrations** — Schema changes, new tables, policy changes
3. **New external integrations** — APIs, services, OAuth scopes
4. **Removing features** — Even if they seem unused
5. **Major refactoring** — Changes spanning 3+ files
6. **Adding state management middleware** — persist, devtools, immer, etc.

---

## Mandatory Practices

### 1. Follow Established Patterns — Consistency Over Cleverness

Every new feature must mirror how existing features are built. Before writing anything, find the nearest analogue in the codebase and use it as your template. If the project has a store that does CRUD with optimistic updates, your new store must work identically — same middleware, same action shape, same error handling.

Inconsistency between features is the most damaging thing an AI agent can introduce. Two modules solving the same problem in different ways creates compounding confusion for every future change.

### 2. Optimistic Updates MUST Have Rollback

Every optimistic update follows this exact template:

```typescript
actionName: async (id: string) => {
  // 1. Capture previous state for rollback
  const previous = get().items.find(item => item.id === id);

  // 2. Optimistic update (UI responds instantly)
  set(state => ({
    items: state.items.map(item =>
      item.id === id ? { ...item, status: 'done' } : item
    ),
  }));

  // 3. Server call with rollback on failure
  try {
    await ApiService.doAction(id);
  } catch (error) {
    // 4. ROLLBACK — restore previous state
    if (previous) {
      set(state => ({
        items: state.items.map(item =>
          item.id === id ? previous : item
        ),
      }));
    }
    toast.error('Action failed. Restored previous state.');
    console.error('actionName failed:', error);
  }
}
```

**Never fire-and-forget.** If you write `service.doThing(id)` without awaiting and catching, you have a bug.

### 3. Type Everything at the Boundary

All external data (API responses, database rows, user input) must be typed at the point of entry. Map once, then trust the types downstream.

```typescript
// Define the shape of what comes from outside
interface DbRow {
  id: string;
  created_at: string;
  some_field: string | null;
}

// Map once at the boundary — this is the ONLY place convention mixing occurs
function fromDb(row: DbRow): DomainModel {
  return {
    id: row.id,
    createdAt: row.created_at,
    someField: row.some_field ?? 'default',
  };
}
```

No `any`, no scattered `|| ''` fallbacks deep in components. Validate and map at the edge; trust the types everywhere else.

### 4. One Component, One Job — Max 150 Lines

If a component exceeds 150 lines, it is doing too much. Decompose:

- Extract data fetching into a custom hook
- Extract business logic into pure utility functions
- Extract repeated UI patterns into sub-components
- Each `useEffect` should do ONE thing — if an effect handles auth, data fetching, AND subscriptions, that's three effects

### 5. Granular Store Subscriptions

Never destructure the entire store. Subscribe to exactly what you need:

```typescript
// GOOD — only re-renders when this specific value changes
const selectedId = useStore(state => state.selectedId);

// GOOD — derived selector
const selectedItem = useStore(state =>
  state.items.find(item => item.id === state.selectedId)
);

// BAD — re-renders on ANY store change
const { items, selectedId, doAction, otherAction } = useStore();
```

### 6. Constants, Not Magic Values

All repeated strings, timeouts, API limits, and configuration values must be named constants in a dedicated file:

```typescript
// BAD — scattered throughout the codebase
if (label === 'FLOWSTATE/ToRead') { ... }
setTimeout(fn, 500);
fetch(`...?maxResults=30`);

// GOOD — defined once, referenced everywhere
export const LABELS = { TO_READ: 'FLOWSTATE/ToRead' } as const;
export const TIMEOUTS = { CHORD_WINDOW: 500 } as const;
export const API = { MAX_RESULTS: 50 } as const;
```

### 7. Derive State, Don't Store It

Never store values that can be computed from existing state. Derived data stored in state WILL desync from its source.

```typescript
// BAD — will desync from items
interface StoreState {
  items: Item[];
  filteredItems: Item[];  // derived — will go stale
  itemCount: number;      // derived — will go stale
}

// GOOD — compute at point of use
const filteredItems = useMemo(
  () => items.filter(i => i.status === activeFilter),
  [items, activeFilter]
);
```

### 8. Test Business Logic as Pure Functions

The most valuable tests are fast, pure function tests that verify logic without rendering anything:

```typescript
describe('filterItems', () => {
  it('returns only active items for the "active" filter', () => {
    const items = [
      makeItem({ status: 'active' }),
      makeItem({ status: 'done' }),
    ];
    expect(filterItems(items, 'active')).toHaveLength(1);
  });
});
```

Priority: pure function tests > hook tests > component tests > integration tests.

### 9. Error Handling Must Be Consistent

Pick one pattern and use it everywhere. Every async action in every store should handle errors identically:

1. Try/catch around the API call
2. Revert optimistic state on failure
3. Show user-facing feedback (toast/notification)
4. Log the error to console with context

Do NOT mix try/catch in some actions, `.catch()` in others, and silent swallowing in the rest.

### 10. Validate User Input at the Component Level

Every form or input must validate before calling store actions:

- Required fields: non-empty check
- Format validation: email addresses, URLs, dates
- Length limits: reasonable maximums
- Display validation errors inline, not just via toast

---

## Common AI Agent Failure Patterns

These are the specific mistakes AI agents make most often. If you catch yourself doing any of these, stop and correct immediately.

### 1. Append-Only Architecture
**Symptom**: Adding new fields, actions, and components without refactoring existing abstractions to accommodate them. Stores grow linearly. Nothing gets consolidated.
**Fix**: Before adding, check if an existing abstraction can be extended or generalized. Four copy-pasted actions that differ by one field should be one generic action.

### 2. Inconsistent Cross-Feature Patterns
**Symptom**: Feature A uses middleware X with error pattern Y. Feature B, built in a later session, uses none of those patterns despite solving identical problems.
**Fix**: New features MUST use the same patterns as existing features. Read the existing stores before creating new ones.

### 3. God Components & God Hooks
**Symptom**: A single hook handling logic for 3 different views. A single component managing auth, layout, routing, and modals. Files exceeding 300 lines.
**Fix**: Split by domain. One hook per view's needs. One component per concern.

### 4. Phantom UI
**Symptom**: Buttons, icons, keyboard shortcut hints, and menu items that render but have no handler attached. The compose button shows a paperclip icon but attachment upload doesn't exist.
**Fix**: If the feature isn't built, the UI element doesn't exist. Period.

### 5. Stale Decision Comments
**Symptom**: Multi-line comments debating approaches (`// DECISION: ...`, `// ACTUALLY: ...`, `// For v2, let's...`) that are now outdated and misleading.
**Fix**: Design decisions belong in PRDs and docs, not in code. Code comments explain "why this approach was chosen", not "what we considered and rejected".

### 6. State Duplication Across Stores
**Symptom**: Two stores tracking the same concept (selection, loading, current view) independently, drifting out of sync.
**Fix**: One store owns each piece of state. Other stores derive from it or subscribe to it. Never duplicate ownership.

### 7. Leaky Service Abstractions
**Symptom**: A "service layer" that is a 1:1 pass-through wrapper adding no value — callers still need to know the underlying API shape.
**Fix**: Services should own retry logic, error normalization, request deduplication, and caching. If a service just forwards calls, either give it real responsibilities or eliminate it.

### 8. Missing UI States
**Symptom**: The happy path renders beautifully. Loading shows a blank screen. Errors crash silently. Empty collections show nothing.
**Fix**: Every component that fetches data must handle four states: **loading**, **error**, **empty**, and **loaded**. Design all four before writing code.

### 9. Over-Subscribing to Global State
**Symptom**: Root-level components destructure 15+ fields from stores, re-rendering the entire app tree on any state change.
**Fix**: Use granular selectors. Push store subscriptions down to the leaf components that actually need them.

### 10. Clever Over Clear
**Symptom**: Dense one-liners, computed values that are never used, nested ternaries, obscure variable names.
**Fix**: Optimize for the next reader, not for line count. Three clear lines beat one cryptic line. If a value is computed, it must be used — otherwise delete it.

---

## Naming Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| Components | PascalCase | `ThreadList.tsx` |
| Hooks | camelCase with `use` prefix | `useMailStore.ts` |
| Utilities | camelCase | `filterItems()` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_SYNC_RESULTS` |
| Database columns | snake_case | `created_at` |
| TypeScript fields | camelCase | `createdAt` |
| CSS classes | kebab-case or utility classes | `email-content` |

The boundary between snake_case (DB) and camelCase (TS) is the mapping functions. These are the ONLY place where convention mixing is acceptable.

---

## Pre-Commit Checklist

Before declaring any change "done", verify:

- [ ] Type checker passes with zero errors
- [ ] No `any` types introduced
- [ ] No TODO comments left behind
- [ ] No UI rendered for unimplemented features
- [ ] All async actions have error handling with user feedback
- [ ] Optimistic updates have rollback on failure
- [ ] New patterns match existing conventions in the codebase
- [ ] Constants used instead of magic strings/numbers
- [ ] Components under 150 lines
- [ ] Store subscriptions are granular (individual selectors)
- [ ] All four UI states handled (loading, error, empty, loaded)
- [ ] Existing features still work after your changes

---

## When In Doubt

**Ask the user.** It is always better to clarify requirements than to implement the wrong thing. A 30-second question saves hours of rework.
