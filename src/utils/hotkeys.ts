/**
 * Centralized Hotkey Registry
 * 
 * Single source of truth for all keyboard shortcuts in the app.
 * Used by ShortcutsModal, CommandPalette, and useTaskListKeyboard.
 */

export type HotkeyCategory = 'navigation' | 'creation' | 'organization' | 'editing' | 'view' | 'habits';
export type HotkeyContext = 'global' | 'task-focused' | 'task-with-date';

export interface Hotkey {
    id: string;
    keys: string;           // Display format (macOS glyphs): "⌘K", "⌥↓", "g then i"
    description: string;
    category: HotkeyCategory;
    context?: HotkeyContext;
    showInModal?: boolean;    // Default true
    showInPalette?: boolean;  // Default false (only contextual actions)
}

/**
 * All hotkeys defined in one place.
 * Order within category determines display order in modal.
 */
export const HOTKEYS: Hotkey[] = [
    // === Navigation ===
    { id: 'nav-down', keys: '↓', description: 'Move Focus Down', category: 'navigation' },
    { id: 'nav-up', keys: '↑', description: 'Move Focus Up', category: 'navigation' },
    { id: 'nav-sidebar', keys: '[ / ]', description: 'Previous / Next Tab', category: 'navigation' },
    { id: 'go-tasks', keys: 'g then t', description: 'Go to Tasks', category: 'navigation' },
    { id: 'go-mail', keys: 'g then m', description: 'Go to Mail', category: 'navigation' },
    { id: 'move-task-down', keys: '⌥↓', description: 'Move Task Down', category: 'navigation', context: 'task-focused' },
    { id: 'move-task-up', keys: '⌥↑', description: 'Move Task Up', category: 'navigation', context: 'task-focused' },
    { id: 'expand', keys: '→', description: 'Expand', category: 'navigation', context: 'task-focused' },
    { id: 'collapse', keys: '←', description: 'Collapse', category: 'navigation', context: 'task-focused' },
    { id: 'expand-all', keys: '⌥⇧→', description: 'Expand All', category: 'navigation' },
    { id: 'collapse-all', keys: '⌥⇧←', description: 'Collapse All', category: 'navigation' },
    { id: 'cmd-palette', keys: '⌘K', description: 'Command Palette', category: 'navigation' },
    { id: 'go-habits', keys: 'g then h', description: 'Go to Habits', category: 'navigation' },

    // === Creation ===
    { id: 'new-task', keys: '↩', description: 'New Task', category: 'creation', showInPalette: true },
    { id: 'new-subtask', keys: '⌘↩', description: 'New Subtask', category: 'creation', context: 'task-focused' },
    { id: 'batch-add', keys: '⌘⇧V', description: 'Batch Add from Clipboard', category: 'creation' },

    // === Organization ===
    { id: 'complete', keys: 'X', description: 'Complete Task', category: 'organization', context: 'task-focused', showInPalette: true },
    { id: 'delete', keys: '⌫', description: 'Delete Task', category: 'organization', context: 'task-focused', showInPalette: true },
    { id: 'indent', keys: '⇥', description: 'Indent (Make Subtask)', category: 'organization', context: 'task-focused' },
    { id: 'outdent', keys: '⇧⇥', description: 'Outdent', category: 'organization', context: 'task-focused' },
    { id: 'set-date', keys: 'D', description: 'Set Due Date', category: 'organization', context: 'task-focused', showInPalette: true },
    { id: 'push-tomorrow', keys: '⇧T', description: 'Push Today’s Tasks to Tomorrow', category: 'organization' },
    { id: 'add-tags', keys: 'L', description: 'Add Tags', category: 'organization', context: 'task-focused', showInModal: false }, // Not implemented yet
    { id: 'toggle-importance', keys: '1', description: 'Mark as Important', category: 'organization', context: 'task-with-date', showInPalette: true },
    { id: 'clear-importance', keys: '0', description: 'Clear Importance', category: 'organization', context: 'task-with-date', showInPalette: true },

    // === Editing ===
    { id: 'edit-title', keys: 'E', description: 'Edit Title', category: 'editing', context: 'task-focused' },
    { id: 'edit-note', keys: 'N', description: 'Edit Note', category: 'editing', context: 'task-focused', showInModal: false }, // Not implemented yet
    { id: 'open-links', keys: '⌘O', description: 'Open Links in Task', category: 'editing', context: 'task-focused' },
    { id: 'undo', keys: '⌘Z', description: 'Undo', category: 'editing' },
    { id: 'redo', keys: '⌘⇧Z', description: 'Redo', category: 'editing' },

    // === View ===
    { id: 'shortcuts-modal', keys: '?', description: 'Show Shortcuts', category: 'view' },

    // === Habits ===
    { id: 'habit-toggle', keys: 'Space / X', description: 'Mark / unmark habit', category: 'habits', context: 'global', showInModal: false },
    { id: 'habit-nav', keys: '↑ ↓ ← →', description: 'Move around the grid', category: 'habits', context: 'global', showInModal: false },
    { id: 'habit-add', keys: 'A', description: 'Add habit', category: 'habits', context: 'global', showInModal: false },
    { id: 'habit-edit', keys: 'E', description: 'Edit habit', category: 'habits', context: 'global', showInModal: false },
    { id: 'habit-delete', keys: '⌫', description: 'Delete habit', category: 'habits', context: 'global', showInModal: false },
    { id: 'habit-week', keys: ', / .', description: 'Previous / next week', category: 'habits', context: 'global', showInModal: false },
];

/**
 * Get hotkeys filtered by category, suitable for modal sections
 */
export function getHotkeysByCategory(category: HotkeyCategory): Hotkey[] {
    return HOTKEYS.filter(h => h.category === category && h.showInModal !== false);
}

/**
 * Get all categories with their hotkeys for modal display
 */
export function getHotkeySections(): { title: string; category: HotkeyCategory; items: Hotkey[] }[] {
    const categories: { title: string; category: HotkeyCategory }[] = [
        { title: 'Navigation', category: 'navigation' },
        { title: 'Creation', category: 'creation' },
        { title: 'Organization', category: 'organization' },
        { title: 'Editing', category: 'editing' },
    ];

    return categories.map(c => ({
        ...c,
        items: getHotkeysByCategory(c.category)
    }));
}

/**
 * Curated modal grouping — ordered by how often a key is actually used,
 * not by internal category. Resolves ids against the registry so the modal,
 * command palette, and real handlers never drift apart.
 */
export function getHotkeyModalGroups(): { title: string; items: Hotkey[] }[] {
    const groups: { title: string; ids: string[] }[] = [
        { title: 'Most used', ids: ['new-task', 'complete', 'nav-down', 'nav-up', 'edit-title', 'set-date', 'delete', 'cmd-palette'] },
        { title: 'Organize', ids: ['indent', 'outdent', 'move-task-up', 'move-task-down', 'toggle-importance', 'clear-importance', 'push-tomorrow'] },
        { title: 'Navigate', ids: ['nav-sidebar', 'expand', 'collapse', 'expand-all', 'collapse-all'] },
        { title: 'Create & history', ids: ['new-subtask', 'batch-add', 'open-links', 'undo', 'redo', 'shortcuts-modal'] },
    ];
    return groups.map(g => ({
        title: g.title,
        items: g.ids
            .map(id => HOTKEYS.find(h => h.id === id))
            .filter((h): h is Hotkey => !!h && h.showInModal !== false),
    }));
}

/**
 * Get hotkeys that should appear in command palette
 */
export function getPaletteHotkeys(): Hotkey[] {
    return HOTKEYS.filter(h => h.showInPalette === true);
}

/**
 * Find hotkey by ID (useful for keyboard handler references)
 */
export function getHotkeyById(id: string): Hotkey | undefined {
    return HOTKEYS.find(h => h.id === id);
}

/**
 * Get hotkey groups filtered by view context
 */
export function getHotkeyModalGroupsByView(view: 'tasks' | 'mail' | 'habits'): { title: string; items: Hotkey[] }[] {
    const groups: { title: string; ids: string[] }[] = [
        { title: 'Most used', ids: ['new-task', 'complete', 'nav-down', 'nav-up', 'edit-title', 'set-date', 'delete', 'cmd-palette'] },
        { title: 'Organize', ids: ['indent', 'outdent', 'move-task-up', 'move-task-down', 'toggle-importance', 'clear-importance', 'push-tomorrow'] },
        { title: 'Get around', ids: ['go-tasks', 'go-mail', 'go-habits', 'nav-sidebar', 'expand', 'collapse'] },
        { title: 'Create & history', ids: ['new-subtask', 'batch-add', 'open-links', 'undo', 'redo', 'shortcuts-modal'] },
    ];

    const resolve = (ids: string[]) => ids
        .map(getHotkeyById)
        .filter((h): h is Hotkey => !!h);

    // The "Get around" group is identical everywhere — it teaches the two-tier
    // model (g-chord = jump section, [ / ] = cycle tabs) in every section.
    const getAround = {
        title: 'Get around',
        items: resolve(['go-tasks', 'go-mail', 'go-habits', 'nav-sidebar', 'cmd-palette']),
    };

    if (view === 'habits') {
        return [
            getAround,
            {
                title: 'Track habits',
                items: resolve(['habit-toggle', 'habit-nav', 'habit-week']),
            },
            {
                title: 'Manage & history',
                items: resolve(['habit-add', 'habit-edit', 'habit-delete', 'undo', 'redo', 'shortcuts-modal']),
            },
        ];
    }

    if (view === 'mail') {
        return [
            getAround,
            {
                title: 'Triage',
                items: resolve(['nav-down', 'nav-up', 'undo', 'redo']),
            },
        ];
    }

    // Tasks view (default)
    return groups.map(g => ({
        title: g.title,
        items: g.ids
            .map(id => HOTKEYS.find(h => h.id === id))
            .filter((h): h is Hotkey => !!h && h.showInModal !== false),
    }));
}
